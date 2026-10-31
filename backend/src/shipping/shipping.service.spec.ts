import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService } from './shipping.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

describe('ShippingService (Melhor Envio)', () => {
  let service: ShippingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'prod-1', name: 'Porta Chaves Gatinho', basePrice: 29.90 },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'MELHORENVIO_ORIGIN_CEP') return '07133-300';
              return null;
            }),
          },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ShippingService>(ShippingService);
  });

  it('should be defined and initialize with origin 07133300', () => {
    expect(service).toBeDefined();
  });

  it('should calculate smart estimates when token is absent for São Paulo destination', async () => {
    const result = await service.calculateShipping({
      destinationPostalCode: '01001-000',
      items: [{ productId: 'prod-1', quantity: 1 }],
    });

    expect(result).toBeDefined();
    expect(result.originPostalCode).toBe('07133300');
    expect(result.destinationPostalCode).toBe('01001000');
    expect(result.quotes.length).toBeGreaterThan(0);
    expect(result.source).toBe('SMART_ESTIMATE');

    const companies = result.quotes.map((q) => q.company);
    expect(companies).toContain('Correios');
    expect(companies).toContain('Jadlog');
  });

  it('should throw BadRequestException if destination postal code is invalid', async () => {
    await expect(
      service.calculateShipping({
        destinationPostalCode: '123',
        items: [{ productId: 'prod-1', quantity: 1 }],
      }),
    ).rejects.toThrow('CEP de destino inválido');
  });
});
