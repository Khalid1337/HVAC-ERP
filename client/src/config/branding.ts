export interface CompanyBranding {
  name: string;
  tagline: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  ntnNumber: string;
}

export const DEFAULT_BRANDING: CompanyBranding = {
  name: "Al-Rehman HVAC & Cooling Solutions",
  tagline: "Industrial & Commercial HVAC Engineering",
  // High-quality SVG placeholder logo (Inline Data URI so print engine never fails to render)
  logoUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none' stroke='%2300f2fe' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'><circle cx='50' cy='50' r='42' stroke='%2338ef7d'/><path d='M50 20v60M20 50h60M29 29l42 42M29 71l42-42'/></svg>",
  address: "Shop #12, Main Auto Market, Saddar, Karachi, Pakistan",
  phone: "+92 300 1234567",
  email: "contact@alrehman-hvac.pk",
  ntnNumber: "NTN: 7894561-2"
};