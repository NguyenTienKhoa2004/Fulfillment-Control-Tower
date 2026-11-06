import type { ApiError } from './types';

export class ApiRequestError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(body.message);
    this.name = 'ApiRequestError';
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 409) {
    return 'Có người khác đã cập nhật sự cố. Dữ liệu đang được tải lại; nội dung bạn nhập vẫn được giữ. Hãy xem trạng thái mới trước khi gửi lại.';
  }
  if (error instanceof ApiRequestError && error.status === 403) return error.message || 'Bạn không có quyền thực hiện thao tác này.';
  if (error instanceof ApiRequestError && error.status === 404) return 'Không tìm thấy dữ liệu hoặc dữ liệu nằm ngoài phạm vi tài khoản.';
  if (error instanceof Error && error.name === 'TypeError') return 'Không thể kết nối máy chủ. Kiểm tra kết nối rồi thử lại.';
  return error instanceof Error ? error.message : 'Không thể thực hiện thao tác. Vui lòng thử lại.';
}

export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiRequestError) || error.status !== 422) return undefined;
  return error.body.field_errors?.find((item) => item.loc.includes(field))?.msg;
}
