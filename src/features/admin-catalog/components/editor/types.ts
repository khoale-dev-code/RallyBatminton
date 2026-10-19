/** Dữ liệu tham chiếu do trang (server) truyền vào màn thêm/sửa sản phẩm. */
export interface EditorBranch {
  id: string;
  name: string;
  /** Có quyền nhập tồn đầu kỳ (inventory.adjust) tại chi nhánh này. */
  canStock: boolean;
}

export interface EditorCategory {
  id: string;
  name: string;
  isActive: boolean;
}
