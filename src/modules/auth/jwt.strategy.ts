import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
