import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EXPENTRA_EMAIL_TEMPLATES } from 'src/core/utils/email/notification.constants';
import type { Expense } from 'src/database/entities/expense.entity';
import type { User } from 'src/database/entities/user.entity';

@Injectable()
export class EmailContentBuilder {
  constructor(private readonly configService: ConfigService) {}

  expenseSubmittedForManager(
    expense: Expense,
    submitter: User,
  ): {
    template: string;
    data: Record<string, unknown>;
  } {
    const amount = this.formatNgn(expense.amount);
    return {
      template: EXPENTRA_EMAIL_TEMPLATES.EXPENSE_SUBMITTED,
      data: {
        firstname: submitter.firstName?.trim() || submitter.email,
        expenseReference: expense.reference,
        title: expense.title,
        amount: amount,
        category: expense.category,
      },
    };
  }

  expenseApprovedForEmployee(expense: Expense): {
    template: string;
    data: Record<string, unknown>;
  } {
    return {
      template: EXPENTRA_EMAIL_TEMPLATES.EXPENSE_APPROVED,
      data: {
        title: expense.title,
        amount: this.formatNgn(expense.amount),
        expenseReference: expense.reference,
      },
    };
  }

  budgetOverspendAlert(payload: {
    expenseReference: string;
    departmentReference: string;
    year: number;
    month: number;
    amountLimit: number;
    projectedCommittedAmount: number;
  }): {
    template: string;
    data: Record<string, unknown>;
  } {
    return {
      template: EXPENTRA_EMAIL_TEMPLATES.EXPENSE_SUBMITTED,
      data: {
        expenseReference: payload.expenseReference,
        departmentReference: payload.departmentReference,
        limit: this.formatNgn(payload.amountLimit),
        projected: this.formatNgn(payload.projectedCommittedAmount),
      },
    };
  }

  expensePendingFinanceReview(expense: Expense): {
    template: string;
    data: Record<string, unknown>;
  } {
    return {
      template: EXPENTRA_EMAIL_TEMPLATES.EXPENSE_SUBMITTED,
      data: {
        title: expense.title,
        amount: this.formatNgn(expense.amount),
        expenseReference: expense.reference,
      },
    };
  }

  expenseEscalationReminder(
    expense: Expense,
    status: string,
  ): {
    template: string;
    data: Record<string, unknown>;
  } {
    return {
      template: EXPENTRA_EMAIL_TEMPLATES.EXPENSE_SUBMITTED,
      data: {
        title: expense.title,
        status,
        expenseReference: expense.reference,
      },
    };
  }

  expenseRejectedForEmployee(
    expense: Expense,
    comment: string,
  ): {
    template: string;
    data: Record<string, unknown>;
  } {
    return {
      template: EXPENTRA_EMAIL_TEMPLATES.EXPENSE_REJECTED,
      data: {
        title: expense.title,
        comment,
        expenseReference: expense.reference,
      },
    };
  }

  expenseReimbursedForEmployee(expense: Expense): {
    template: string;
    data: Record<string, unknown>;
  } {
    return {
      template: EXPENTRA_EMAIL_TEMPLATES.EXPENSE_REIMBURSED,
      data: {
        title: expense.title,
        amount: this.formatNgn(expense.amount),
        expenseReference: expense.reference,
      },
    };
  }

  emailVerification(
    email: string,
    verifyToken: string,
    firstName?: string,
  ): {
    template: string;
    data: Record<string, unknown>;
  } {
    return {
      template: EXPENTRA_EMAIL_TEMPLATES.EMAIL_VERIFICATION,
      data: {
        firstname: firstName?.trim() || email,
        email,
        otpCode: verifyToken,
        otpValidityMinutes: 24 * 60,
      },
    };
  }

  passwordReset(
    email: string,
    resetToken: string,
    firstName?: string,
  ): {
    template: string;
    data: Record<string, unknown>;
  } {
    const link = this.passwordResetLink(resetToken);
    return {
      template: EXPENTRA_EMAIL_TEMPLATES.OTP_ALERT,
      data: {
        firstname: firstName?.trim() || email,
        email,
        resetToken,
        link,
        otpCode: resetToken,
        otpValidityMinutes: 15,
      },
    };
  }

  exportReady(payload: { fileName: string; exportLabel: string }): {
    template: string;
    data: Record<string, unknown>;
  } {
    return {
      template: EXPENTRA_EMAIL_TEMPLATES.EXPORT_READY,
      data: {
        fileName: payload.fileName,
        exportLabel: payload.exportLabel,
        hasAttachment: true,
      },
    };
  }

  private formatNgn(amount: number): string {
    const naira = amount / 100;
    return `₦${naira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private displayName(user: User): string {
    const parts = [user.firstName, user.lastName]
      .map((p) => p?.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : user.email;
  }

  private appUrl(): string {
    return (
      this.configService.get<string>('APP_URL')?.replace(/\/$/, '') ??
      'http://localhost:5167'
    );
  }

  private passwordResetLink(token: string): string {
    return `${this.appUrl()}/verify-otp?token=${encodeURIComponent(token)}`;
  }
}
