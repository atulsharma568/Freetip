export const rupeeText = (rupees: number) =>
  rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 });
