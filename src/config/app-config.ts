import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Movers CRM",
  version: packageJson.version,
  copyright: `© ${currentYear}, Movers CRM.`,
  meta: {
    title: "Movers CRM",
    description: "Sales, dispatch, warehouse, and client records for a moving company.",
  },
};
