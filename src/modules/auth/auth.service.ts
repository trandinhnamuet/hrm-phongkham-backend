import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserStatus } from '../../entities/user.entity';
import { normalizeEmail, normalizePhone } from '../../common/utils/contact';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  /** Tìm tài khoản theo email (có '@') hoặc theo số điện thoại. */
  private async findByIdentifier(identifier: string): Promise<User | null> {
    if (identifier.includes('@')) {
      const email = normalizeEmail(identifier);
      return email ? this.userRepo.findOne({ where: { email } }) : null;
    }
    let phone: string | null;
    try {
      phone = normalizePhone(identifier);
    } catch {
      return null; // Không phải số điện thoại -> coi như sai thông tin đăng nhập.
    }
    return phone ? this.userRepo.findOne({ where: { phone } }) : null;
  }

  async login(identifier: string, password: string) {
    if (!identifier.trim()) {
      throw new BadRequestException('Vui lòng nhập email hoặc số điện thoại');
    }
    const WRONG = 'Email/số điện thoại hoặc mật khẩu không đúng';
    const user = await this.findByIdentifier(identifier);
    if (!user) throw new UnauthorizedException(WRONG);

    const valid = await user.validatePassword(password);
    if (!valid) throw new UnauthorizedException(WRONG);

    // jwt.strategy cũng chặn tài khoản không ACTIVE, nhưng báo ngay ở đây cho rõ
    // thay vì cho đăng nhập rồi mọi request sau đều 401.
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã ngừng hoạt động');
    }

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
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { department: true, shift: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  private sanitize(user: User) {
    const { passwordHash, ...rest } = user as any;
    return rest;
  }
}
