import app from "./app";

const PORT = (globalThis as any).process?.env?.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});