import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      status: 'ONLINE',
      platform: 'EuSou Platform API',
      message: 'Backend conectado ao Supabase e operacional.',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
