import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InstrumentsService } from './instruments.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from '../dto/update-instrument.dto';

@Controller('api/instruments')
export class InstrumentsController {
    constructor(private readonly instrumentsService: InstrumentsService) { }


    @Get()
    async findAll(
        @Query('status') status?: string,
        @Query('location') location?: string,
        @Query('frequency') frequency?: string,
        @Query('search') search?: string,
        @Query('page') page: string = '1',
        @Query('pageSize') pageSize: string = '10',
        @Query('createdBy') createdBy?: string
    ) {
        const pageNumber = parseInt(page, 10);
        const limit = parseInt(pageSize, 10);

        return this.instrumentsService.findAll({
            status,
            location,
            frequency,
            search,
            page: pageNumber,
            pageSize: limit,
            createdBy
        });
    }

    @Get('filters/:createdById')
    async getFilterParams(@Param('createdById') createdById: string) {
        return this.instrumentsService.findFilterParams(createdById);
    }


    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.instrumentsService.findOne(id);
    }

    @Post()
    create(@Body() createInstrumentDto: CreateInstrumentDto) {
        return this.instrumentsService.create(createInstrumentDto);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateInstrumentDto: UpdateInstrumentDto
    ) {
        return this.instrumentsService.update(id, updateInstrumentDto);
    }

}
