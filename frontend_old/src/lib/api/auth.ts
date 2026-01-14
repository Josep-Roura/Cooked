function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function loginAPI(data: {
  email: string;
  password: string;
}) {
  await delay(700);

  if (
    data.email.toLowerCase() === "demo@cooked.ai" &&
    data.password === "123456"
  ) {
    return {
      name: "Demo User",
      email: "demo@cooked.ai"
    };
  }

  throw new Error("Credenciales inválidas");
}
