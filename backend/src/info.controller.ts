import { Controller, Get } from '@nestjs/common';

@Controller('info')
export class InfoController {
  @Get()
  getInfo() {
    return {
      name: 'Product Platform',
      version: '0.0.1',
      description: 'Fundação técnica do projeto de gestão de produtos',
    };
  }
}
