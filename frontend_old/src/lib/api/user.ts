export type UserProfile = {
  name: string;
  email: string;
  role: string;
  language: string;
  twoFactorEnabled: boolean;
};

// Estado simulado en memoria para el usuario autenticado
let USER_DB = {
  name: "Demo User",
  email: "demo@cooked.ai",
  role: "admin",
  language: "es",
  twoFactorEnabled: false
};

// helper de latencia
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// GET perfil
export async function getUserProfileAPI(): Promise<UserProfile> {
  await delay(500);
  return { ...USER_DB };
}

export async function updateUserProfileAPI(data: {
  name: string;
  email: string;
  language: string;
}): Promise<UserProfile> {
  await delay(800);
  if (data.email.toLowerCase().includes("error")) {
    throw new Error("Ese email no es válido o ya está en uso.");
  }
  USER_DB = {
    ...USER_DB,
    name: data.name,
    email: data.email,
    language: data.language
  };
  return { ...USER_DB };
}


// UPDATE seguridad
export async function updateUserSecurityAPI(data: {
  currentPassword: string;
  newPassword: string;
  twoFactorEnabled: boolean;
}): Promise<{ success: true }> {
  await delay(800);

  if (data.currentPassword !== "123456") {
    throw new Error("Contraseña actual incorrecta.");
  }

  USER_DB = {
    ...USER_DB,
    twoFactorEnabled: data.twoFactorEnabled
  };

  return { success: true };
}

