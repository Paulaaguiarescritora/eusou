import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService, SendOrderEmailInput } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let configService: ConfigService;

  const mockOrder: SendOrderEmailInput = {
    orderId: 'ord-test-12345678',
    customerName: 'Cliente Teste',
    customerEmail: 'cliente@teste.com',
    customerPhone: '11999999999',
    items: [
      {
        name: 'Porta-Chaves Decorativo',
        variantName: 'Preto Fosco',
        quantity: 2,
        price: 29.9,
        subtotal: 59.8,
      },
    ],
    subtotal: 59.8,
    shippingAmount: 12.5,
    shippingService: 'Melhor Envio .Package',
    total: 72.3,
    street: 'Rua das Flores',
    number: '123',
    complement: 'Apto 45',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01001-000',
    paymentMethod: 'PIX',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'MAIL_FROM') return 'EuSou <loja@eusou.com.br>';
              if (key === 'STORE_NOTIFICATION_EMAIL') return 'admin@eusou.com.br';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('deve simular envio com fallback em log quando nenhuma credencial externa for configurada', async () => {
    const result = await service.sendOrderConfirmation(mockOrder);
    expect(result).toBe(false);
  });

  it('deve gerar template HTML contendo todos os dados do pedido, itens e endereço', () => {
    const html = (service as any).buildOrderEmailHtml(mockOrder);

    expect(html).toContain('Cliente Teste');
    expect(html).toContain('ord-test-12345678');
    expect(html).toContain('Porta-Chaves Decorativo');
    expect(html).toContain('Preto Fosco');
    expect(html).toContain('R$ 72,20'.replace('20', '30')); // 72.30
    expect(html).toContain('Rua das Flores, 123 (Apto 45)');
    expect(html).toContain('01001-000');
    expect(html).toContain('Melhor Envio .Package');
  });

  it('deve enviar e-mail via Resend quando resendClient estiver configurado', async () => {
    const mockSend = jest.fn().mockResolvedValue({ data: { id: 'email-resend-id-999' } });
    (service as any).resendClient = {
      emails: {
        send: mockSend,
      },
    };

    const result = await service.sendOrderConfirmation(mockOrder);

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'EuSou <loja@eusou.com.br>',
        to: ['cliente@teste.com'],
        bcc: ['admin@eusou.com.br'],
        subject: expect.stringContaining('#ORD-TEST'),
      }),
    );
  });

  it('deve enviar e-mail via SMTP quando nodemailerTransporter estiver configurado', async () => {
    (service as any).resendClient = null;
    const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'smtp-msg-123' });
    (service as any).nodemailerTransporter = {
      sendMail: mockSendMail,
    };

    const result = await service.sendOrderConfirmation(mockOrder);

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'EuSou <loja@eusou.com.br>',
        to: 'cliente@teste.com',
        bcc: 'admin@eusou.com.br',
        subject: expect.stringContaining('#ORD-TEST'),
      }),
    );
  });
});
