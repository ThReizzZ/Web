export function roleLabel(role: string): string {
  if (role === "admin") {
    return "管理员";
  }
  if (role === "moderator") {
    return "版主";
  }
  return "成员";
}
