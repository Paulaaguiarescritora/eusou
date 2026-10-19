import { Test, TestingModule } from '@nestjs/testing';
import { OrderExpirationScheduler } from './order-expiration.scheduler';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma.service';
import { OrderStatus } from '@prisma/client';

describe('OrderExpirationScheduler — Automator & Stock Release', () => {
  let scheduler: OrderExpirationScheduler;
  let orderService: any;
  let prisma: any;

  beforeEach(async () => {
    orderService = {
      expireUnpaidOrders: jest.fn(),
    };

    prisma = {
      order: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderExpirationScheduler,
        { provide: OrderService, useValue: orderService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    scheduler = module.get<OrderExpirationScheduler>(OrderExpirationScheduler);
  });

  it('deve identificar pedidos PENDING com paymentDeadline passado, cancelar e liberar reservas', async () => {
    // 1 pedido pendente com prazo de pagamento expirado encontrado
    prisma.order.count.mockResolvedValue(1);

    orderService.expireUnpaidOrders.mockResolvedValue({
      expiredCount: 1,
      orderIds: ['ord-expired-101'],
    });

    const result = await scheduler.handleExpirationJob();

    expect(prisma.order.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OrderStatus.PENDING,
          paymentDeadline: expect.objectContaining({
            lte: expect.any(Date),
          }),
        }),
      }),
    );

    expect(orderService.expireUnpaidOrders).toHaveBeenCalledWith('system-expiration-cron');
    expect(result.found).toBe(1);
    expect(result.expired).toBe(1);
    expect(result.released).toBe(1);
  });

  it('quando o job for executado novamente sem novos pedidos vencidos, não deve haver novas liberações (idempotência)', async () => {
    // Na segunda execução consecutiva, nenhum pedido pendente vencido é encontrado
    prisma.order.count.mockResolvedValue(0);

    const result = await scheduler.handleExpirationJob();

    expect(prisma.order.count).toHaveBeenCalled();
    // Como nenhum pedido foi encontrado, não precisa invocar a rotina de transação pesada
    expect(orderService.expireUnpaidOrders).not.toHaveBeenCalled();
    expect(result.found).toBe(0);
    expect(result.expired).toBe(0);
    expect(result.released).toBe(0);
  });

  it('deve impedir execuções simultâneas/sobrepostas via trava de concorrência em memória (in-memory lock)', async () => {
    prisma.order.count.mockImplementation(async () => {
      // Simula uma operação de banco que leva algum tempo
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 1;
    });

    orderService.expireUnpaidOrders.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { expiredCount: 1, orderIds: ['ord-concurrent-1'] };
    });

    // Dispara a primeira execução e a segunda logo em seguida antes da primeira terminar
    const firstRunPromise = scheduler.handleExpirationJob();
    const secondRunPromise = scheduler.handleExpirationJob();

    const [firstResult, secondResult] = await Promise.all([
      firstRunPromise,
      secondRunPromise,
    ]);

    // Primeira execução processou com sucesso
    expect(firstResult.expired).toBe(1);

    // Segunda execução foi bloqueada pelo lock de concorrência
    expect(secondResult.found).toBe(0);
    expect(secondResult.expired).toBe(0);
    expect(orderService.expireUnpaidOrders).toHaveBeenCalledTimes(1);
  });

  it('deve registrar erro de forma segura e liberar a trava em caso de falha', async () => {
    prisma.order.count.mockRejectedValue(new Error('Erro de conexão transitório com o banco'));

    await expect(scheduler.handleExpirationJob()).rejects.toThrow('Erro de conexão transitório com o banco');

    // A trava deve ter sido liberada no bloco finally, permitindo nova execução posterior
    prisma.order.count.mockResolvedValue(0);
    const subsequentResult = await scheduler.handleExpirationJob();
    expect(subsequentResult.found).toBe(0);
  });
});
