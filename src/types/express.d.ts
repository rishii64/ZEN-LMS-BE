import { User, Organization, UserMembership } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      organization?: Organization;
      membership?: UserMembership & { department?: any };
    }
  }
}
