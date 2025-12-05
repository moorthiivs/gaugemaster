// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PGBossModule } from '@loctax/nest-pg-boss';

import { UsersModule } from './users/users.module';
import { InstrumentsModule } from './instruments/instruments.module';
import { ReportsModule } from './reports/reports.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CompanyModule } from './company/company.module';
import { SettingsModule } from './settings/settings.module';
import { ReminderModule } from './reminder/reminder.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),

    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT!, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: true,
      synchronize: true,
      ssl: { rejectUnauthorized: false },
    }),

    AuthModule,
    UsersModule,
    InstrumentsModule,
    ReportsModule,
    DashboardModule,
    CompanyModule,
    SettingsModule,
    ReminderModule,

    // ⭐ PgBoss correct async config (NO ERRORS)
    PGBossModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        application_name: "default",

        host: config.get<string>("DB_HOST"),
        user: config.get<string>("DB_USERNAME"),
        password: config.get<string>("DB_PASSWORD"),
        database: config.get<string>("DB_NAME"),

        schema: "public",
        max: config.get<number>("DB_POOL_MAX") || 10,
        ssl: {
          rejectUnauthorized: false,   // ⭐ same as TypeORM
        },
        // Required by PgBoss
        onError: (err: Error) => {
          console.error("PgBoss Error:", err.message);
        },
      }),

      inject: [ConfigService],
    }),

  ],
})
export class AppModule { }
