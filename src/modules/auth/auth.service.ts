import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const valid = await user.validatePassword(password);
    if (!valid) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN'),
    });

    return {
      accessToken,
      user: this.sanitize(user),
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  private sanitize(user: User) {
    const { passwordHash, ...rest } = user as any;
    return rest;
  }
}
