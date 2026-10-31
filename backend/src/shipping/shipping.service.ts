import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';

export interface ShippingQuote {
  id: number | string;
  name: string;
  company: string;
  companyLogo?: string;
  price: number;
  deliveryDays: number;
  deliveryRange?: { min: number; max: number };
  error?: string;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly originPostalCode: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const rawOrigin = this.configService.get<string>('MELHORENVIO_ORIGIN_CEP') || '07133-300';
    this.originPostalCode = rawOrigin.replace(/\D/g, '');
  }

  /**
   * Calcula cotações de frete via API do Melhor Envio com fallback inteligente
   */
  async calculateShipping(dto: CalculateShippingDto): Promise<{
    originPostalCode: string;
    destinationPostalCode: string;
    quotes: ShippingQuote[];
    source: 'MELHOR_ENVIO' | 'SMART_ESTIMATE';
  }> {
    const cleanDestination = (dto.destinationPostalCode || '').replace(/\D/g, '');

    if (cleanDestination.length !== 8) {
      throw new BadRequestException('CEP de destino inválido. O CEP deve conter 8 dígitos.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Nenhum item informado para cálculo de frete.');
    }

    // Carrega dados dos produtos para determinar peso e valor segurado
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        basePrice: true,
      },
    });

    const productsMap = new Map(products.map((p) => [p.id, p]));

    // Prepara payload de produtos para o Melhor Envio
    const melhorEnvioProducts = dto.items.map((item, idx) => {
      const prod = productsMap.get(item.productId);
      const price = Number(prod?.basePrice || 25.0);

      return {
        id: item.productId || `item-${idx + 1}`,
        width: 12, // Largura em cm
        height: 8, // Altura em cm
        length: 16, // Comprimento em cm
        weight: 0.15, // Peso em kg (150g padrão p/ acessórios pet 3D)
        insurance_value: price,
        quantity: item.quantity,
      };
    });

    let token = this.configService.get<string>('MELHORENVIO_TOKEN');
    let effectiveOrigin = this.originPostalCode;

    // Fallback: se não estiver na variável de ambiente (ex: deploy sem env manual no Render),
    // busca automaticamente no banco de dados Supabase persistido
    if (!token || token.trim().length < 10) {
      try {
        const meAccount = await this.prisma.channelAccount.findFirst({
          where: { name: 'Melhor Envio', status: 'ACTIVE' },
        });
        if (meAccount && meAccount.configuration) {
          const conf = meAccount.configuration as any;
          if (conf.token && conf.token.trim().length > 10) {
            token = conf.token.trim();
          }
          if (conf.originPostalCode) {
            effectiveOrigin = String(conf.originPostalCode).replace(/\D/g, '');
          }
        }
      } catch (err: any) {
        this.logger.warn(`Erro ao consultar credenciais do Melhor Envio no banco: ${err.message}`);
      }
    }

    const isSandbox = (this.configService.get<string>('MELHORENVIO_ENVIRONMENT') || '').toUpperCase() === 'SANDBOX';
    const baseUrl = isSandbox
      ? 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate'
      : 'https://melhorenvio.com.br/api/v2/me/shipment/calculate';

    if (token && token.trim().length > 10) {
      try {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token.trim()}`,
            'User-Agent': 'KUBOSTUDIO Store (contato@kubostudio.com.br)',
          },
          body: JSON.stringify({
            from: { postal_code: effectiveOrigin },
            to: { postal_code: cleanDestination },
            products: melhorEnvioProducts,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            const validQuotes: ShippingQuote[] = [];

            for (const item of data) {
              if (item.error) continue;
              const rawPrice = Number(item.custom_price || item.price || 0);
              if (rawPrice <= 0) continue;

              const deliveryDays = Number(item.custom_delivery_time || item.delivery_time || 3);

              validQuotes.push({
                id: item.id,
                name: item.name,
                company: item.company?.name || 'Transportadora',
                companyLogo: item.company?.picture,
                price: rawPrice,
                deliveryDays,
                deliveryRange: item.custom_delivery_range || item.delivery_range,
              });
            }

            if (validQuotes.length > 0) {
              validQuotes.sort((a, b) => a.price - b.price);
              return {
                originPostalCode: this.originPostalCode,
                destinationPostalCode: cleanDestination,
                quotes: validQuotes,
                source: 'MELHOR_ENVIO',
              };
            }
          }
        } else {
          const errBody = await response.text();
          this.logger.warn(`Melhor Envio API error [${response.status}]: ${errBody}`);
        }
      } catch (err: any) {
        this.logger.warn(`Falha na chamada à API do Melhor Envio: ${err?.message}`);
      }
    }

    // Fallback inteligente caso o token ainda não esteja configurado
    const smartQuotes = this.generateSmartEstimates(cleanDestination);
    return {
      originPostalCode: this.originPostalCode,
      destinationPostalCode: cleanDestination,
      quotes: smartQuotes,
      source: 'SMART_ESTIMATE',
    };
  }

  /**
   * Gera estimativas realistas de cotação com base na região do CEP de destino
   */
  private generateSmartEstimates(destCep: string): ShippingQuote[] {
    const cepPrefix = parseInt(destCep.substring(0, 2), 10);

    // Faixas aproximadas por região brasileira
    // 01-09: Grande São Paulo (Origem é 07133-300 / Guarulhos)
    // 11-19: Interior / Litoral de SP
    // 20-28: Rio de Janeiro
    // 30-39: Minas Gerais
    // 40-49: Bahia / Sergipe
    // 80-87: Paraná
    // 88-89: Santa Catarina
    // 90-99: Rio Grande do Sul

    let isLocalSP = cepPrefix >= 1 && cepPrefix <= 9;
    let isStateSP = cepPrefix >= 11 && cepPrefix <= 19;
    let isSudeste = (cepPrefix >= 20 && cepPrefix <= 39);
    let isSul = (cepPrefix >= 80 && cepPrefix <= 99);

    if (isLocalSP) {
      return [
        {
          id: 3,
          name: '.Package',
          company: 'Jadlog',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/jadlog.png',
          price: 11.90,
          deliveryDays: 2,
        },
        {
          id: 17,
          name: 'Express',
          company: 'Loggi',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/loggi.png',
          price: 12.50,
          deliveryDays: 1,
        },
        {
          id: 2,
          name: 'PAC',
          company: 'Correios',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/correios.png',
          price: 13.80,
          deliveryDays: 3,
        },
        {
          id: 1,
          name: 'SEDEX',
          company: 'Correios',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/correios.png',
          price: 16.50,
          deliveryDays: 1,
        },
      ];
    } else if (isStateSP) {
      return [
        {
          id: 3,
          name: '.Package',
          company: 'Jadlog',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/jadlog.png',
          price: 14.50,
          deliveryDays: 3,
        },
        {
          id: 2,
          name: 'PAC',
          company: 'Correios',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/correios.png',
          price: 16.20,
          deliveryDays: 4,
        },
        {
          id: 1,
          name: 'SEDEX',
          company: 'Correios',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/correios.png',
          price: 21.90,
          deliveryDays: 2,
        },
      ];
    } else if (isSudeste || isSul) {
      return [
        {
          id: 3,
          name: '.Package',
          company: 'Jadlog',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/jadlog.png',
          price: 18.90,
          deliveryDays: 4,
        },
        {
          id: 2,
          name: 'PAC',
          company: 'Correios',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/correios.png',
          price: 22.40,
          deliveryDays: 6,
        },
        {
          id: 1,
          name: 'SEDEX',
          company: 'Correios',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/correios.png',
          price: 33.80,
          deliveryDays: 3,
        },
      ];
    } else {
      // Demais regiões (Centro-Oeste, Nordeste, Norte)
      return [
        {
          id: 3,
          name: '.Package',
          company: 'Jadlog',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/jadlog.png',
          price: 26.50,
          deliveryDays: 6,
        },
        {
          id: 2,
          name: 'PAC',
          company: 'Correios',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/correios.png',
          price: 29.80,
          deliveryDays: 8,
        },
        {
          id: 1,
          name: 'SEDEX',
          company: 'Correios',
          companyLogo: 'https://melhorenvio.com.br/images/shipping-companies/correios.png',
          price: 49.90,
          deliveryDays: 4,
        },
      ];
    }
  }
}
