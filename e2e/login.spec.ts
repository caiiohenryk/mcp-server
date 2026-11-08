import { expect, test } from "@playwright/test";

test.describe("/login", () => {
  test("renders the sign-in page with the configured provider", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Entrar/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Um só jeito de escrever código, para todo agente.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeVisible();
    // The specimen shows a real rule with its RFC 2119 level.
    await expect(page.getByRole("complementary", { name: "Exemplo de regra" })).toContainText(
      /MUST/,
    );
    await expect(page.locator("#login-alert")).toBeEmpty();
  });

  test("explains AccessDenied and who to ask", async ({ page }) => {
    await page.goto("/login?error=AccessDenied");
    const alert = page.locator("#login-alert");
    await expect(alert).toContainText("Seu e-mail não está na lista de acesso");
    await expect(alert).toContainText("Peça a um admin da plataforma");
  });

  test("keeps a safe ?next= destination and drops external ones", async ({ page }) => {
    await page.goto("/login?next=/standards");
    await expect(page.locator('input[name="next"]')).toHaveValue("/standards");
    await page.goto("/login?next=https://evil.example");
    await expect(page.locator('input[name="next"]')).toHaveValue("/tokens");
  });

  test("protected pages redirect to /login without a session", async ({ page }) => {
    await page.goto("/tokens");
    await expect(page).toHaveURL(/\/login\?next=%2Ftokens/);
  });
});
