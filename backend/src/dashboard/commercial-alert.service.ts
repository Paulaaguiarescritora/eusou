import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  ChannelAccountStatus,
  ChannelProductStatus,
  MarketplaceEventStatus,
  OrderStatus,
} from '@prisma/client';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface CommercialAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  entityRelated: string;
  entityId?: string;
  createdAt: Date;
  recommendedAction: 'VER' | 'CORRIGIR' | 'SINCRONIZAR' | 'REPROCESSAR' | 'IGNORAR';
  actionUrl: string;
}

export type OperationHealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface OperationHealth {
  status: OperationHealthStatus;
  label: string;
  summary: string;
  counts: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
}

@Injectable()
export class CommercialAlertService {
  private readonly logger = new Logger(CommercialAlertService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consolida e deriva todos os alertas acionáveis da operação em tempo real
   */
  async getAlerts(): Promise<CommercialAlert[]> {
    const alerts: CommercialAlert[] = [];

    // 1. ALERTAS CRÍTICOS & ATENÇÃO: Contas de canais / Marketplaces desconectadas ou com erro
    const accounts = await this.prisma.channelAccount.findMany({
      include: { channel: true },
    });
    for (const acc of accounts) {
      if (acc.status === ChannelAccountStatus.ERROR) {
        alerts.push({
          id: `acc-err-${acc.id}`,
          type: 'CHANNEL_ACCOUNT_ERROR',
          severity: 'CRITICAL',
          title: `Conta ${acc.name} com Erro de Conexão`,
          description: `A conta do canal ${acc.channel.name} está em estado de erro e não pode sincronizar dados.`,
          entityRelated: 'ChannelAccount',
          entityId: acc.id,
          createdAt: acc.updatedAt,
          recommendedAction: 'CORRIGIR',
          actionUrl: '/admin/marketplaces',
        });
      } else if (acc.status === ChannelAccountStatus.DISCONNECTED) {
        alerts.push({
          id: `acc-disc-${acc.id}`,
          type: 'CHANNEL_ACCOUNT_DISCONNECTED',
          severity: 'CRITICAL',
          title: `Conta ${acc.name} Desconectada`,
          description: `A conta do canal ${acc.channel.name} está desconectada. Reautentique para reativar publicações e pedidos.`,
          entityRelated: 'ChannelAccount',
          entityId: acc.id,
          createdAt: acc.updatedAt,
          recommendedAction: 'CORRIGIR',
          actionUrl: '/admin/marketplaces',
        });
      }
    }

    // 2. ALERTAS CRÍTICOS: Eventos webhook falhos após retentativas
    const failedEvents = await this.prisma.marketplaceEvent.findMany({
      where: {
        status: MarketplaceEventStatus.FAILED,
      },
      include: { channel: true },
      take: 10,
      orderBy: { receivedAt: 'desc' },
    });
    for (const ev of failedEvents) {
      alerts.push({
        id: `ev-fail-${ev.id}`,
        type: 'WEBHOOK_EVENT_FAILED',
        severity: 'CRITICAL',
        title: `Evento de Webhook Falhou (${ev.channel?.name || 'Canal'})`,
        description: `Tópico "${ev.topic}": ${ev.lastError || 'Falha após múltiplas tentativas'}. Requer intervenção ou reprocessamento.`,
        entityRelated: 'MarketplaceEvent',
        entityId: ev.id,
        createdAt: ev.receivedAt,
        recommendedAction: 'REPROCESSAR',
        actionUrl: '/admin/marketplaces',
      });
    }

    // 3. ALERTAS CRÍTICOS & ATENÇÃO: Pedidos de Marketplace com inconsistência ou erro
    const problematicOrders = await this.prisma.channelOrder.findMany({
      where: {
        externalStatus: { in: ['failed', 'error', 'cancelled_by_marketplace'] },
      },
      take: 10,
    });
    for (const co of problematicOrders) {
      alerts.push({
        id: `co-incon-${co.id}`,
        type: 'CHANNEL_ORDER_PROBLEM',
        severity: 'CRITICAL',
        title: `Pedido Externo ${co.externalOrderId} com Falha no Canal`,
        description: `Status externo: ${co.externalStatus}. Verifique o faturamento ou estoque no canal.`,
        entityRelated: 'ChannelOrder',
        entityId: co.id,
        createdAt: co.createdAt,
        recommendedAction: 'CORRIGIR',
        actionUrl: '/admin/orders',
      });
    }

    // 4. ALERTAS DE ESTOQUE: Saldo crítico ou zerado (Inventory F7)
    // Regra:
    // - Produto sem variantes → usar estoque do produto.
    // - Produto com variantes → ignorar estoque do produto-pai e alertar somente pelas variantes ativas.
    // - Não misturar nem duplicar alertas de estoque do produto com suas variantes.
    const productsWithStock = await this.prisma.product.findMany({
      where: { status: { not: 'ARCHIVED' } },
      include: {
        variants: {
          where: { isActive: true },
          include: { inventories: true },
        },
        inventories: {
          where: { variantId: null },
        },
      },
    });

    for (const prod of productsWithStock) {
      const activeVariants = prod.variants || [];
      const hasVariants = activeVariants.length > 0;

      if (hasVariants) {
        // Produto com variantes:
        // Avalia individualmente as variantes ativas. O estoque do produto-pai é ignorado.
        for (const variant of activeVariants) {
          const varInv = variant.inventories?.[0];
          if (!varInv) continue;

          const available = varInv.quantity - varInv.reservedQuantity;
          const variantLabel = variant.name || variant.sku || 'Variante';

          if (available <= 0) {
            alerts.push({
              id: `inv-out-${varInv.id}`,
              type: 'STOCK_OUT',
              severity: 'CRITICAL',
              title: `Estoque Esgotado: ${prod.name} (${variantLabel})`,
              description: `Variante "${variantLabel}" disponível: ${available} unid. (Total: ${varInv.quantity}, Reservado: ${varInv.reservedQuantity}). Produtos esgotados pausam vendas.`,
              entityRelated: 'Inventory',
              entityId: varInv.id,
              createdAt: varInv.updatedAt,
              recommendedAction: 'CORRIGIR',
              actionUrl: '/admin/inventory',
            });
          } else if (available <= varInv.minimumQuantity) {
            alerts.push({
              id: `inv-low-${varInv.id}`,
              type: 'STOCK_LOW',
              severity: 'WARNING',
              title: `Estoque Baixo: ${prod.name} (${variantLabel})`,
              description: `Variante "${variantLabel}" disponível: ${available} unid., abaixo do mínimo estipulado (${varInv.minimumQuantity} unid.). Inicie ordem de produção.`,
              entityRelated: 'Inventory',
              entityId: varInv.id,
              createdAt: varInv.updatedAt,
              recommendedAction: 'VER',
              actionUrl: '/admin/production',
            });
          }
        }
      } else {
        // Produto sem variantes: usa o estoque próprio do produto
        const parentInv = prod.inventories?.[0];
        if (!parentInv) continue;

        const available = parentInv.quantity - parentInv.reservedQuantity;
        if (available <= 0) {
          alerts.push({
            id: `inv-out-${parentInv.id}`,
            type: 'STOCK_OUT',
            severity: 'CRITICAL',
            title: `Estoque Esgotado: ${prod.name}`,
            description: `Disponível: ${available} unid. (Total: ${parentInv.quantity}, Reservado: ${parentInv.reservedQuantity}). Produtos esgotados pausam vendas.`,
            entityRelated: 'Inventory',
            entityId: parentInv.id,
            createdAt: parentInv.updatedAt,
            recommendedAction: 'CORRIGIR',
            actionUrl: '/admin/inventory',
          });
        } else if (available <= parentInv.minimumQuantity) {
          alerts.push({
            id: `inv-low-${parentInv.id}`,
            type: 'STOCK_LOW',
            severity: 'WARNING',
            title: `Estoque Baixo: ${prod.name}`,
            description: `Disponível: ${available} unid., abaixo do mínimo estipulado (${parentInv.minimumQuantity} unid.). Inicie ordem de produção.`,
            entityRelated: 'Inventory',
            entityId: parentInv.id,
            createdAt: parentInv.updatedAt,
            recommendedAction: 'VER',
            actionUrl: '/admin/production',
          });
        }
      }
    }

    // 5. ALERTAS DE CANAL / PRODUTOS COM ERRO OU DIVERGÊNCIA
    const errorChannelProducts = await this.prisma.channelProduct.findMany({
      where: {
        status: ChannelProductStatus.ERROR,
      },
      include: { product: true, channelAccount: { include: { channel: true } } },
      take: 10,
    });
    for (const cp of errorChannelProducts) {
      alerts.push({
        id: `cp-err-${cp.id}`,
        type: 'CHANNEL_PRODUCT_ERROR',
        severity: 'CRITICAL',
        title: `Erro de Publicação: ${cp.product.name}`,
        description: `Canal: ${cp.channelAccount.channel.name}. Falha na sincronização ou rejeição pelo canal.`,
        entityRelated: 'ChannelProduct',
        entityId: cp.id,
        createdAt: cp.updatedAt,
        recommendedAction: 'CORRIGIR',
        actionUrl: '/admin/marketplaces',
      });
    }

    // 6. ALERTAS DE CATALOGO: Produtos ativos sem categoria ou sem preço base
    const productsNoCat = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        categories: { none: {} },
      },
      take: 10,
    });
    for (const p of productsNoCat) {
      alerts.push({
        id: `prod-nocat-${p.id}`,
        type: 'PRODUCT_WITHOUT_CATEGORY',
        severity: 'WARNING',
        title: `Produto Ativo sem Categoria: ${p.name}`,
        description: `Produtos sem categoria não aparecem corretamente nos catálogos nem podem ser mapeados em canais.`,
        entityRelated: 'Product',
        entityId: p.id,
        createdAt: p.updatedAt,
        recommendedAction: 'CORRIGIR',
        actionUrl: '/admin/products',
      });
    }

    // Ordenação estrita: CRITICAL primeiro, depois WARNING, depois INFO; mais recentes primeiro
    const severityWeight: Record<AlertSeverity, number> = {
      CRITICAL: 3,
      WARNING: 2,
      INFO: 1,
    };

    alerts.sort((a, b) => {
      const diff = severityWeight[b.severity] - severityWeight[a.severity];
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return alerts;
  }

  /**
   * Avalia a saúde global da operação com base nas regras de severidade
   */
  async getOperationHealth(): Promise<OperationHealth> {
    const alerts = await this.getAlerts();
    const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
    const warningCount = alerts.filter((a) => a.severity === 'WARNING').length;
    const infoCount = alerts.filter((a) => a.severity === 'INFO').length;

    let status: OperationHealthStatus = 'HEALTHY';
    let label = 'Operação Saudável';
    let summary = 'Todos os serviços, canais, estoques e pedidos estão em conformidade.';

    if (criticalCount > 0) {
      status = 'CRITICAL';
      label = 'Problemas Críticos';
      summary = `${criticalCount} item(ns) crítico(s) necessita(m) de intervenção imediata (canais, pedidos ou rupturas de estoque).`;
    } else if (warningCount > 0) {
      status = 'WARNING';
      label = 'Atenção Necessária';
      summary = `${warningCount} ponto(s) de atenção identificado(s) na operação (estoque baixo ou cadastros incompletos).`;
    }

    return {
      status,
      label,
      summary,
      counts: {
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
        total: alerts.length,
      },
    };
  }
}
