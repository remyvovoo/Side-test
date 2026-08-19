import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Premier filet de sécurité du projet. On cible volontairement la logique
 * PURE — géométrie du détourage, placement du logo, correspondances TCGdex :
 * c'est là que se sont produites les régressions coûteuses, et ça se teste
 * sans navigateur ni canvas. Le rendu studio, lui, se juge à l'œil sur pièce ;
 * l'automatiser demanderait une comparaison d'images qui ne dirait rien de la
 * seule question qui compte (« est-ce que c'est beau »).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
