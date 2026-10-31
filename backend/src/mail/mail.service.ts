import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

export interface SendOrderEmailInput {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    variantName?: string | null;
    quantity: number;
    price: number | string;
    subtotal: number | string;
  }>;
  subtotal: number | string;
  shippingAmount: number | string;
  shippingService?: string | null;
  total: number | string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  paymentMethod?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resendClient: Resend | null = null;
  private nodemailerTransporter: nodemailer.Transporter | null = null;
  private senderEmail: string;

  constructor(private readonly config: ConfigService) {
    this.initClients();
  }

  private initClients() {
    const resendKey =
      this.config.get<string>('RESEND_API_KEY') || process.env.RESEND_API_KEY;
    const smtpHost =
      this.config.get<string>('SMTP_HOST') || process.env.SMTP_HOST;
    const smtpUser =
      this.config.get<string>('SMTP_USER') || process.env.SMTP_USER;
    const smtpPass =
      this.config.get<string>('SMTP_PASS') || process.env.SMTP_PASS;
    const smtpPort =
      Number(this.config.get<string>('SMTP_PORT') || process.env.SMTP_PORT) ||
      587;

    this.senderEmail =
      this.config.get<string>('MAIL_FROM') ||
      process.env.MAIL_FROM ||
      'KUBOSTUDIO <onboarding@resend.dev>';

    if (resendKey && resendKey.trim()) {
      this.resendClient = new Resend(resendKey.trim());
      this.logger.log('MailService initialized with Resend provider.');
    } else if (smtpUser && smtpPass && smtpHost) {
      this.nodemailerTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log(`MailService initialized with SMTP (${smtpHost}:${smtpPort}).`);
    } else {
      this.logger.warn(
        'Nenhum provedor de e-mail configurado (RESEND_API_KEY ou SMTP). E-mails serão registrados em log.',
      );
    }
  }

  /**
   * Envia a confirmação do pedido para o cliente e cópia para o lojista
   */
  async sendOrderConfirmation(order: SendOrderEmailInput): Promise<boolean> {
    const subject = `Pedido Confirmado #${order.orderId.slice(0, 8).toUpperCase()} - KUBOSTUDIO`;
    const html = this.buildOrderEmailHtml(order);
    const storeNotificationEmail =
      this.config.get<string>('STORE_NOTIFICATION_EMAIL') ||
      process.env.STORE_NOTIFICATION_EMAIL ||
      '3dkubostudio@gmail.com';

    // 1. Tentar via Resend
    if (this.resendClient) {
      try {
        const recipients = [order.customerEmail];
        const res = await this.resendClient.emails.send({
          from: this.senderEmail,
          to: recipients,
          bcc: storeNotificationEmail ? [storeNotificationEmail] : undefined,
          subject,
          html,
        });

        this.logger.log(
          `E-mail de confirmação enviado via Resend para ${order.customerEmail} (ID: ${res.data?.id})`,
        );
        return true;
      } catch (err: any) {
        this.logger.error(`Falha ao enviar e-mail via Resend: ${err.message}`);
      }
    }

    // 2. Tentar via Nodemailer SMTP
    if (this.nodemailerTransporter) {
      try {
        await this.nodemailerTransporter.sendMail({
          from: this.senderEmail,
          to: order.customerEmail,
          bcc: storeNotificationEmail || undefined,
          subject,
          html,
        });
        this.logger.log(
          `E-mail de confirmação enviado via SMTP para ${order.customerEmail}`,
        );
        return true;
      } catch (err: any) {
        this.logger.error(`Falha ao enviar e-mail via SMTP: ${err.message}`);
      }
    }

    // 3. Fallback em log
    this.logger.log(
      `[SIMULAÇÃO DE E-MAIL] Para: ${order.customerEmail} | Assunto: ${subject} | Total: R$ ${order.total}`,
    );
    return false;
  }

  private buildOrderEmailHtml(order: SendOrderEmailInput): string {
    const trackingUrl = `https://eusou-lemon.vercel.app/pedido/${order.orderId}`;
    const itemsHtml = order.items
      .map(
        (i) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 0;">
            <strong style="color: #0f172a; font-size: 14px;">${i.name}</strong>
            ${
              i.variantName
                ? `<br><span style="color: #64748b; font-size: 12px;">Variante: ${i.variantName}</span>`
                : ''
            }
            <br><span style="color: #94a3b8; font-size: 12px;">Qtd: ${i.quantity}</span>
          </td>
          <td style="padding: 12px 0; text-align: right; color: #0f172a; font-weight: bold; font-size: 14px;">
            R$ ${Number(i.subtotal).toFixed(2).replace('.', ',')}
          </td>
        </tr>
      `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Pedido Confirmado</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #334155;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Cabeçalho -->
          <tr>
            <td style="background-color: #0f172a; padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: -0.5px;">KUBOSTUDIO</h1>
              <p style="color: #94a3b8; margin: 4px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Loja Especializada & Produtos Exclusivos</p>
            </td>
          </tr>

          <!-- Mensagem Principal -->
          <tr>
            <td style="padding: 32px 24px 16px; text-align: center;">
              <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; background-color: #ecfdf5; color: #059669; border-radius: 50%; font-size: 28px; margin-bottom: 16px;">
                ✓
              </div>
              <h2 style="color: #0f172a; margin: 0 0 8px; font-size: 22px; font-weight: 800;">Pagamento Confirmado!</h2>
              <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.5;">
                Olá, <strong>${order.customerName}</strong>! Seu pedido foi confirmado e nossa equipe já está cuidando da preparação com todo carinho.
              </p>
            </td>
          </tr>

          <!-- Detalhes do Pedido -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0; font-size: 13px;">
                <p style="margin: 0 0 6px;"><strong>Número do Pedido:</strong> <span style="font-family: monospace; color: #0f172a;">${order.orderId}</span></p>
                <p style="margin: 0;"><strong>Forma de Pagamento:</strong> ${order.paymentMethod || 'Pix (Aprovado)'}</p>
              </div>

              <h3 style="color: #0f172a; font-size: 15px; margin: 24px 0 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Itens do Pedido</h3>
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                ${itemsHtml}
              </table>

              <!-- Totais -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 16px; font-size: 13px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Subtotal</td>
                  <td style="padding: 6px 0; text-align: right; color: #0f172a;">R$ ${Number(order.subtotal).toFixed(2).replace('.', ',')}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Frete (${order.shippingService || 'Melhor Envio'})</td>
                  <td style="padding: 6px 0; text-align: right; color: #0f172a;">R$ ${Number(order.shippingAmount).toFixed(2).replace('.', ',')}</td>
                </tr>
                <tr style="border-top: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0 0; font-weight: bold; font-size: 16px; color: #0f172a;">Total</td>
                  <td style="padding: 12px 0 0; text-align: right; font-weight: 800; font-size: 18px; color: #059669;">
                    R$ ${Number(order.total).toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              </table>

              <!-- Endereço de Entrega -->
              <h3 style="color: #0f172a; font-size: 15px; margin: 28px 0 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">Endereço de Entrega</h3>
              <p style="color: #475569; font-size: 13px; line-height: 1.6; margin: 0; background-color: #f8fafc; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <strong>${order.customerName}</strong><br>
                ${order.street}, ${order.number} ${order.complement ? `(${order.complement})` : ''}<br>
                ${order.neighborhood} - ${order.city}/${order.state}<br>
                CEP: ${order.zipCode}
              </p>

              <!-- Botão de Acompanhamento -->
              <div style="text-align: center; margin: 36px 0 16px;">
                <a href="${trackingUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
                  Acompanhar Meu Pedido →
                </a>
              </div>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b;">
              Dúvidas sobre sua entrega? Responda a este e-mail ou entre em contato com nosso suporte.<br>
              <strong>KUBOSTUDIO</strong> • Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
