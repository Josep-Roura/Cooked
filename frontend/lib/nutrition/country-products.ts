/**
 * Country-specific sports nutrition products and brands
 * Used to provide localized recommendations based on user location
 */

export type CountryCode = "ES" | "MX" | "AR" | "CO" | "BR" | "US" | "UK" | "DE" | "FR" | "IT" | "CH" | "AU" | "NZ" | "CA" | "OTHER"

export interface SportsProduct {
  name: string
  category: "hydration" | "carbs" | "protein" | "electrolytes" | "bar" | "gel"
  brand: string
  calories?: number
  carbs_g?: number
  protein_g?: number
  sodium_mg?: number
}

export interface CountryProductCatalog {
  country: CountryCode
  countryName: string
  products: SportsProduct[]
}

/**
 * Product recommendations by country
 * Includes popular and available sports nutrition brands in each region
 */
export const countryProductCatalogs: CountryProductCatalog[] = [
  // Spain
  {
    country: "ES",
    countryName: "España",
    products: [
      // Hydration
      { name: "Aquarius", category: "hydration", brand: "Coca-Cola", sodium_mg: 300 },
      { name: "Powerade", category: "hydration", brand: "Coca-Cola", sodium_mg: 305 },
      { name: "226ERS Isotonic Drink", category: "hydration", brand: "226ERS", sodium_mg: 330 },
      { name: "Bebida de Esfuerzo Ergoxtrem", category: "hydration", brand: "Ergoxtrem", sodium_mg: 380 },
      { name: "Liquid Power", category: "hydration", brand: "Nutratletic", sodium_mg: 320 },

      // Carbs/Energy
      { name: "PowerBar", category: "bar", brand: "PowerBar", calories: 230, carbs_g: 47, protein_g: 10 },
      { name: "Clif Bar", category: "bar", brand: "Clif Bar", calories: 240, carbs_g: 44, protein_g: 9 },
      { name: "226ERS Bar", category: "bar", brand: "226ERS", calories: 220, carbs_g: 40, protein_g: 10 },
      { name: "Barrita de Energía SiS", category: "bar", brand: "Science in Sport", calories: 200, carbs_g: 42, protein_g: 5 },
      { name: "Gel Energético 226ERS", category: "gel", brand: "226ERS", calories: 100, carbs_g: 25, protein_g: 0 },

      // Protein
      { name: "Protein Bar Myprotein", category: "protein", brand: "Myprotein", calories: 200, carbs_g: 15, protein_g: 20 },
      { name: "Barrita Proteica Decathlon", category: "protein", brand: "Decathlon", calories: 190, carbs_g: 18, protein_g: 19 },
      { name: "IsoPro Bar", category: "protein", brand: "Science in Sport", calories: 180, carbs_g: 10, protein_g: 25 },

      // Electrolytes
      { name: "Sales de Rehidratación SiS", category: "electrolytes", brand: "Science in Sport", sodium_mg: 500 },
      { name: "Electrolitos GoPro", category: "electrolytes", brand: "GoPro", sodium_mg: 480 },
    ],
  },

  // Mexico
  {
    country: "MX",
    countryName: "México",
    products: [
      // Hydration
      { name: "Gatorade", category: "hydration", brand: "Gatorade", sodium_mg: 305 },
      { name: "Powerade", category: "hydration", brand: "Coca-Cola", sodium_mg: 305 },
      { name: "Sporade", category: "hydration", brand: "Tropicana", sodium_mg: 290 },
      { name: "Bebida Energética XS", category: "hydration", brand: "XS Energy", sodium_mg: 350 },
      { name: "Iso Gatorade Melon", category: "hydration", brand: "Gatorade", sodium_mg: 310 },

      // Carbs/Energy
      { name: "Clif Bar", category: "bar", brand: "Clif Bar", calories: 240, carbs_g: 44, protein_g: 9 },
      { name: "PowerBar", category: "bar", brand: "PowerBar", calories: 230, carbs_g: 47, protein_g: 10 },
      { name: "Barrita Energética Nature Valley", category: "bar", brand: "Nature Valley", calories: 180, carbs_g: 35, protein_g: 4 },
      { name: "Gel Energético Hammer", category: "gel", brand: "Hammer Nutrition", calories: 100, carbs_g: 22, protein_g: 0 },

      // Protein
      { name: "Protein Bar Optimum", category: "protein", brand: "Optimum Nutrition", calories: 210, carbs_g: 12, protein_g: 21 },
      { name: "Barrita Proteica Premier", category: "protein", brand: "Premier Nutrition", calories: 200, carbs_g: 18, protein_g: 20 },

      // Electrolytes
      { name: "Sales de Rehidratación DripDrop", category: "electrolytes", brand: "DripDrop", sodium_mg: 510 },
      { name: "Electrolitos Nuun", category: "electrolytes", brand: "Nuun", sodium_mg: 480 },
    ],
  },

  // Argentina
  {
    country: "AR",
    countryName: "Argentina",
    products: [
      // Hydration
      { name: "Gatorade", category: "hydration", brand: "Gatorade", sodium_mg: 305 },
      { name: "Powerade", category: "hydration", brand: "Coca-Cola", sodium_mg: 305 },
      { name: "Bebida de Esfuerzo Deportivo", category: "hydration", brand: "Local Brands", sodium_mg: 300 },
      { name: "Isótonica Pro", category: "hydration", brand: "Musashi", sodium_mg: 320 },

      // Carbs/Energy
      { name: "Clif Bar", category: "bar", brand: "Clif Bar", calories: 240, carbs_g: 44, protein_g: 9 },
      { name: "PowerBar", category: "bar", brand: "PowerBar", calories: 230, carbs_g: 47, protein_g: 10 },
      { name: "Barrita Deportiva Musashi", category: "bar", brand: "Musashi", calories: 210, carbs_g: 38, protein_g: 11 },

      // Protein
      { name: "Proteína Musashi", category: "protein", brand: "Musashi", calories: 200, carbs_g: 16, protein_g: 22 },
      { name: "Bar de Proteína Optimum", category: "protein", brand: "Optimum Nutrition", calories: 210, carbs_g: 12, protein_g: 21 },

      // Electrolytes
      { name: "Sales de Rehidratación Gatorade", category: "electrolytes", brand: "Gatorade", sodium_mg: 500 },
    ],
  },

  // Colombia
  {
    country: "CO",
    countryName: "Colombia",
    products: [
      // Hydration
      { name: "Gatorade", category: "hydration", brand: "Gatorade", sodium_mg: 305 },
      { name: "Powerade", category: "hydration", brand: "Coca-Cola", sodium_mg: 305 },
      { name: "Isótonica Local", category: "hydration", brand: "Local Sports Brands", sodium_mg: 290 },

      // Carbs/Energy
      { name: "Clif Bar", category: "bar", brand: "Clif Bar", calories: 240, carbs_g: 44, protein_g: 9 },
      { name: "PowerBar", category: "bar", brand: "PowerBar", calories: 230, carbs_g: 47, protein_g: 10 },

      // Protein
      { name: "Protein Bar Optimum", category: "protein", brand: "Optimum Nutrition", calories: 210, carbs_g: 12, protein_g: 21 },

      // Electrolytes
      { name: "Electrolitos Gatorade", category: "electrolytes", brand: "Gatorade", sodium_mg: 500 },
    ],
  },

  // Brazil
  {
    country: "BR",
    countryName: "Brasil",
    products: [
      // Hydration
      { name: "Gatorade", category: "hydration", brand: "Gatorade", sodium_mg: 305 },
      { name: "Powerade", category: "hydration", brand: "Coca-Cola", sodium_mg: 305 },
      { name: "Bebida Isotônica Bradesco", category: "hydration", brand: "Bradesco Sports", sodium_mg: 300 },

      // Carbs/Energy
      { name: "Clif Bar", category: "bar", brand: "Clif Bar", calories: 240, carbs_g: 44, protein_g: 9 },
      { name: "PowerBar", category: "bar", brand: "PowerBar", calories: 230, carbs_g: 47, protein_g: 10 },
      { name: "Barrita Muweex", category: "bar", brand: "Muweex", calories: 200, carbs_g: 40, protein_g: 8 },

      // Protein
      { name: "Protein Bar Whey", category: "protein", brand: "Optimum Nutrition", calories: 210, carbs_g: 12, protein_g: 21 },

      // Electrolytes
      { name: "Eletrólitos Gatorade", category: "electrolytes", brand: "Gatorade", sodium_mg: 500 },
    ],
  },

  // USA
  {
    country: "US",
    countryName: "United States",
    products: [
      // Hydration
      { name: "Gatorade", category: "hydration", brand: "Gatorade", sodium_mg: 305 },
      { name: "Powerade", category: "hydration", brand: "Coca-Cola", sodium_mg: 305 },
      { name: "Liquid IV", category: "hydration", brand: "Liquid IV", sodium_mg: 350 },
      { name: "Nuun", category: "hydration", brand: "Nuun", sodium_mg: 310 },

      // Carbs/Energy
      { name: "Clif Bar", category: "bar", brand: "Clif Bar", calories: 240, carbs_g: 44, protein_g: 9 },
      { name: "PowerBar", category: "bar", brand: "PowerBar", calories: 230, carbs_g: 47, protein_g: 10 },
      { name: "Hammer Bar", category: "bar", brand: "Hammer Nutrition", calories: 210, carbs_g: 42, protein_g: 8 },
      { name: "GU Energy Gel", category: "gel", brand: "GU", calories: 100, carbs_g: 25, protein_g: 0 },

      // Protein
      { name: "Clif Bar Protein", category: "protein", brand: "Clif Bar", calories: 200, carbs_g: 22, protein_g: 9 },
      { name: "Quest Bar", category: "protein", brand: "Quest", calories: 190, carbs_g: 21, protein_g: 20 },

      // Electrolytes
      { name: "DripDrop", category: "electrolytes", brand: "DripDrop", sodium_mg: 510 },
      { name: "Liquid IV Hydration", category: "electrolytes", brand: "Liquid IV", sodium_mg: 500 },
    ],
  },

  // UK
  {
    country: "UK",
    countryName: "United Kingdom",
    products: [
      // Hydration
      { name: "Lucozade", category: "hydration", brand: "Lucozade", sodium_mg: 330 },
      { name: "Powerade", category: "hydration", brand: "Coca-Cola", sodium_mg: 305 },
      { name: "SiS GO Hydro", category: "hydration", brand: "Science in Sport", sodium_mg: 340 },

      // Carbs/Energy
      { name: "Clif Bar", category: "bar", brand: "Clif Bar", calories: 240, carbs_g: 44, protein_g: 9 },
      { name: "PowerBar", category: "bar", brand: "PowerBar", calories: 230, carbs_g: 47, protein_g: 10 },
      { name: "SiS GO Bar", category: "bar", brand: "Science in Sport", calories: 200, carbs_g: 42, protein_g: 5 },
      { name: "GU Energy Gel", category: "gel", brand: "GU", calories: 100, carbs_g: 25, protein_g: 0 },

      // Protein
      { name: "Myprotein Bar", category: "protein", brand: "Myprotein", calories: 200, carbs_g: 15, protein_g: 20 },
      { name: "SiS Whey Protein Bar", category: "protein", brand: "Science in Sport", calories: 190, carbs_g: 18, protein_g: 22 },

      // Electrolytes
      { name: "SiS Hydro Tablets", category: "electrolytes", brand: "Science in Sport", sodium_mg: 480 },
    ],
  },

  // Germany
  {
    country: "DE",
    countryName: "Deutschland",
    products: [
      // Hydration
      { name: "Isostar", category: "hydration", brand: "Isostar", sodium_mg: 320 },
      { name: "Powerbar PowerDrink", category: "hydration", brand: "PowerBar", sodium_mg: 330 },

      // Carbs/Energy
      { name: "Clif Bar", category: "bar", brand: "Clif Bar", calories: 240, carbs_g: 44, protein_g: 9 },
      { name: "PowerBar", category: "bar", brand: "PowerBar", calories: 230, carbs_g: 47, protein_g: 10 },
      { name: "Isostar Bar", category: "bar", brand: "Isostar", calories: 210, carbs_g: 40, protein_g: 8 },

      // Protein
      { name: "Myprotein Bar", category: "protein", brand: "Myprotein", calories: 200, carbs_g: 15, protein_g: 20 },

      // Electrolytes
      { name: "Isostar Elektrolyte", category: "electrolytes", brand: "Isostar", sodium_mg: 500 },
    ],
  },

  // France
  {
    country: "FR",
    countryName: "France",
    products: [
      // Hydration
      { name: "Isostar", category: "hydration", brand: "Isostar", sodium_mg: 320 },
      { name: "Powerbar PowerDrink", category: "hydration", brand: "PowerBar", sodium_mg: 330 },

      // Carbs/Energy
      { name: "Clif Bar", category: "bar", brand: "Clif Bar", calories: 240, carbs_g: 44, protein_g: 9 },
      { name: "PowerBar", category: "bar", brand: "PowerBar", calories: 230, carbs_g: 47, protein_g: 10 },

      // Protein
      { name: "Myprotein Bar", category: "protein", brand: "Myprotein", calories: 200, carbs_g: 15, protein_g: 20 },

      // Electrolytes
      { name: "Isostar Électrolytes", category: "electrolytes", brand: "Isostar", sodium_mg: 500 },
    ],
  },

  // Australia
  {
    country: "AU",
    countryName: "Australia",
    products: [
      // Hydration
      { name: "Gatorade", category: "hydration", brand: "Gatorade", sodium_mg: 305 },
      { name: "Powerade", category: "hydration", brand: "Coca-Cola", sodium_mg: 305 },
      { name: "Musashi Isotonic", category: "hydration", brand: "Musashi", sodium_mg: 300 },

      // Carbs/Energy
      { name: "Clif Bar", category: "bar", brand: "Clif Bar", calories: 240, carbs_g: 44, protein_g: 9 },
      { name: "PowerBar", category: "bar", brand: "PowerBar", calories: 230, carbs_g: 47, protein_g: 10 },
      { name: "Musashi Bar", category: "bar", brand: "Musashi", calories: 210, carbs_g: 40, protein_g: 10 },

      // Protein
      { name: "Musashi Protein Bar", category: "protein", brand: "Musashi", calories: 200, carbs_g: 14, protein_g: 21 },

      // Electrolytes
      { name: "Musashi Electrolyte", category: "electrolytes", brand: "Musashi", sodium_mg: 500 },
    ],
  },
]

/**
 * Get country code from user location
 * Returns the CountryCode or "OTHER" as fallback
 */
export function getCountryCode(country?: string): CountryCode {
  if (!country) return "OTHER"

  const normalizedCountry = country.toUpperCase().trim()

  // Direct match
  const codes: Record<string, CountryCode> = {
    ES: "ES",
    ESPAÑA: "ES",
    SPAIN: "ES",
    MX: "MX",
    MEXICO: "MX",
    AR: "AR",
    ARGENTINA: "ARGENTINA",
    CO: "CO",
    COLOMBIA: "CO",
    BR: "BR",
    BRAZIL: "BR",
    BRASIL: "BR",
    US: "US",
    USA: "US",
    UNITED_STATES: "US",
    UK: "UK",
    UNITED_KINGDOM: "UK",
    DE: "DE",
    GERMANY: "DE",
    DEUTSCHLAND: "DE",
    FR: "FR",
    FRANCE: "FR",
    IT: "IT",
    ITALY: "IT",
    CH: "CH",
    SWITZERLAND: "CH",
    AU: "AU",
    AUSTRALIA: "AU",
    NZ: "NZ",
    NEW_ZEALAND: "NZ",
    CA: "CA",
    CANADA: "CA",
  }

  return codes[normalizedCountry] || "OTHER"
}

/**
 * Get products for a specific country
 */
export function getCountryProducts(countryCode: CountryCode): SportsProduct[] {
  const catalog = countryProductCatalogs.find((c) => c.country === countryCode)
  if (!catalog) {
    // Return default products (Spain as default)
    return countryProductCatalogs[0]?.products || []
  }
  return catalog.products
}

/**
 * Get country name from country code
 */
export function getCountryName(countryCode: CountryCode): string {
  const catalog = countryProductCatalogs.find((c) => c.country === countryCode)
  return catalog?.countryName || "Other"
}

/**
 * Format products list for AI prompt
 */
export function formatProductsForPrompt(products: SportsProduct[]): string {
  const grouped = products.reduce(
    (acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = []
      }
      acc[product.category].push(`${product.name} (${product.brand})`)
      return acc
    },
    {} as Record<string, string[]>
  )

  return Object.entries(grouped)
    .map(([category, items]) => {
      return `${category.toUpperCase()}:\n${items.map((item) => `- ${item}`).join("\n")}`
    })
    .join("\n\n")
}
