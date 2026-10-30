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
  PayloadTooLargeException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { StandardsService } from './standards.service';
import { CreateStandardDto } from './dto/create-standard.dto';
import { UpdateStandardDto } from './dto/update-standard.dto';

import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

const uploadDirectory = './uploads/standards';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB max allowed
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const fileFilter = (req: any, file: any, cb: any) => {
  if (
    file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml|pdf|csv|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|x-excel|excel)$/i) ||
    file.originalname.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf|xlsx|xls|csv)$/i)
  ) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Only PDF, Image, and Excel (XLSX, XLS, CSV) files are allowed'), false);
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
    cb(null, `std-${uniqueSuffix}${ext}`);
  },
});

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/standards')
export class StandardsController {
  constructor(private readonly service: StandardsService) {}

  @Get()
  @RequirePermission('standards', 'view')
  async findAll(
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    const isSuperAdmin = !!req.user?.isSuperAdmin;
    const companyId = isSuperAdmin ? (queryCompanyId || req.user?.companyId) : req.user?.companyId;
    return this.service.findAll(companyId, search, type);
  }

  @Get('types')
  @RequirePermission('standards', 'view')
  async getDistinctTypes(@Req() req: any, @Query('companyId') queryCompanyId?: string) {
    const isSuperAdmin = !!req.user?.isSuperAdmin;
    const companyId = isSuperAdmin ? (queryCompanyId || req.user?.companyId) : req.user?.companyId;
    return this.service.getDistinctTypes(companyId);
  }

  @Get(':id')
  @RequirePermission('standards', 'view')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const companyId = req.user?.companyId;
    return this.service.findOne(id, companyId);
  }

  @Post()
  @RequirePermission('standards', 'create')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES }, // 50MB max
    }),
  )
  async create(
    @Req() req: any,
    @Body() dto: CreateStandardDto,
    @UploadedFile() file?: any,
  ) {
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeException('File size exceeds maximum allowed limit of 50MB. Please select a file under 50MB.');
    }

    const user = req.user || {};
    const isSuperAdmin = !!user.isSuperAdmin;
    const companyId = isSuperAdmin ? (dto.companyId || user.companyId) : user.companyId;
    const userId = user.id || user.userId || user.sub;
    const userName = user.name || user.fullName || user.email || 'User';

    return this.service.create(dto, file, { id: userId, name: userName, companyId });
  }

  @Put(':id')
  @RequirePermission('standards', 'edit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES }, // 50MB max
    }),
  )
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateStandardDto,
    @UploadedFile() file?: any,
  ) {
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeException('File size exceeds maximum allowed limit of 50MB. Please select a file under 50MB.');
    }

    const user = req.user || {};
    const companyId = user.companyId;
    const userId = user.id || user.userId || user.sub;
    const userName = user.name || user.fullName || user.email || 'User';

    return this.service.update(id, dto, file, { id: userId, name: userName, companyId });
  }

  @Delete(':id')
  @RequirePermission('standards', 'delete')
  async remove(
    @Param('id') id: string,
    @Req() req: any,
    @Query('reason') queryReason?: string,
    @Body('reason') bodyReason?: string,
  ) {
    const user = req.user || {};
    const companyId = user.companyId;
    const reason = bodyReason || queryReason;
    return this.service.remove(id, companyId, user, reason);
  }

  @Get(':id/history')
  @RequirePermission('standards', 'view')
  async getHistory(@Param('id') id: string, @Req() req: any) {
    const user = req.user || {};
    const companyId = user.companyId;
    return this.service.getHistory(id, companyId);
  }
}

