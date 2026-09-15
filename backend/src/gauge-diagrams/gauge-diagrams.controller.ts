import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { GaugeDiagramsService } from './gauge-diagrams.service';
import { CreateGaugeDiagramDto } from './dto/create-gauge-diagram.dto';
import { UpdateGaugeDiagramDto } from './dto/update-gauge-diagram.dto';

const uploadDirectory = './uploads/gauge-diagrams';
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const fileFilter = (req: any, file: any, cb: any) => {
  if (
    file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml|pdf)$/) ||
    file.originalname.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf)$/i)
  ) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Only PDF and image files (PNG, JPG, SVG, WebP) are allowed'), false);
  }
};

const storage = diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `diagram-${uniqueSuffix}${ext}`);
  },
});

@UseGuards(AuthGuard('jwt'))
@Controller('api/gauge-diagrams')
export class GaugeDiagramsController {
  constructor(private readonly service: GaugeDiagramsService) {}

  @Get()
  async findAll(
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @Query('search') search?: string,
  ) {
    const user = req.user || {};
    const companyId = queryCompanyId || user.companyId || (user.company && user.company.id);
    return this.service.findAll(companyId, search);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const user = req.user || {};
    const companyId = user.companyId || (user.company && user.company.id);
    return this.service.findOne(id, companyId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter,
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async create(
    @Req() req: any,
    @Body() dto: CreateGaugeDiagramDto,
    @UploadedFile() file?: any,
  ) {
    const user = req.user || {};
    const companyId = dto.companyId || user.companyId || (user.company && user.company.id);
    const userId = user.id || user.sub;
    const userName = user.name || user.fullName || user.email || 'User';

    return this.service.create(dto, file, { id: userId, name: userName, companyId });
  }

  @Put(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter,
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateGaugeDiagramDto,
    @UploadedFile() file?: any,
  ) {
    const user = req.user || {};
    const companyId = user.companyId || (user.company && user.company.id);
    const userId = user.id || user.sub;
    const userName = user.name || user.fullName || user.email || 'User';

    return this.service.update(id, dto, file, { id: userId, name: userName, companyId });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const user = req.user || {};
    const companyId = user.companyId || (user.company && user.company.id);
    return this.service.remove(id, companyId);
  }

  @Get(':id/history')
  async getHistory(@Param('id') id: string, @Req() req: any) {
    const user = req.user || {};
    const companyId = user.companyId || (user.company && user.company.id);
    return this.service.getHistory(id, companyId);
  }
}
