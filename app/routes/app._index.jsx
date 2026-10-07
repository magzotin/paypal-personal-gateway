import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const settings = await prisma.payPalSettings.findUnique({
    where: {
      shop: session.shop,
    },
  });

  console.log("[PAYPAL DEBUG] Loaded settings:", {
    shop: session.shop,
    settings,
  });

  return {
  shop: session.shop,
  settings: settings || {

      paypalEmail: "",
      currency: "USD",
      enabled: true,
      buttonText: "Pay with PayPal",
    },
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();

  const paypalEmail = String(formData.get("paypalEmail") || "").trim();
  const currency = String(formData.get("currency") || "USD").trim();
  const enabled = formData.get("enabled") === "true";
  const buttonText =
    String(formData.get("buttonText") || "Pay with PayPal").trim();

  if (!paypalEmail) {
    return {
      success: false,
      error: "PayPal email is required.",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(paypalEmail)) {
    return {
      success: false,
      error: "Please enter a valid PayPal email address.",
    };
  }

  const allowedCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD"];

  if (!allowedCurrencies.includes(currency)) {
    return {
      success: false,
      error: "Invalid currency.",
    };
  }

  const finalButtonText = buttonText || "Pay with PayPal";

  console.log("[PAYPAL DEBUG] Saving settings:", {
    shop: session.shop,
    paypalEmail,
    currency,
    enabled,
    buttonText,
  });

  const settings = await prisma.payPalSettings.upsert({
    where: {
      shop: session.shop,
    },
    update: {
      paypalEmail,
      currency,
      enabled,
      buttonText: finalButtonText,
    },
    create: {
      shop: session.shop,
      paypalEmail,
      currency,
      enabled,
      buttonText: finalButtonText,
    },
  });

  return {
    success: true,
    settings,
  };
};

export default function PayPalGateway() {
  const fetcher = useFetcher();
  const loaderData = useLoaderData();
  const shop = loaderData?.shop || "";
  const shopify = useAppBridge();

  const [paypalEmail, setPaypalEmail] = useState(
    loaderData?.settings?.paypalEmail || ""
  );
  const [currency, setCurrency] = useState(
    loaderData?.settings?.currency || "USD"
  );
  const [enabled, setEnabled] = useState(
    loaderData?.settings?.enabled ?? true
  );
  const [buttonText, setButtonText] = useState(
    loaderData?.settings?.buttonText || "Pay with PayPal"
  );

  const data = fetcher.data;
  const settings = data?.settings ?? loaderData?.settings;

  useEffect(() => {
    if (settings) {
      setPaypalEmail(settings.paypalEmail || "");
      setCurrency(settings.currency || "USD");
      setEnabled(settings.enabled ?? true);
      setButtonText(settings.buttonText || "Pay with PayPal");
    }
  }, [settings]);

  useEffect(() => {
    if (data?.success) {
      shopify.toast.show("PayPal settings saved");
    }

    if (data?.error) {
      shopify.toast.show(data.error);
    }
  }, [data, shopify]);

  const isSaving = fetcher.state !== "idle";

  const saveSettings = () => {
    fetcher.submit(
      {
        paypalEmail,
        currency,
        enabled: String(enabled),
        buttonText,
      },
      {
        method: "POST",
      },
    );
  };

  return (
    <s-page heading="PayPal Personal Gateway">
      <s-section heading="PayPal Settings">
        <s-stack direction="block" gap="base">
          <s-text-field
            label="PayPal Email"
            value={paypalEmail}
            placeholder="your-paypal@email.com"
            onInput={(event) => setPaypalEmail(event.currentTarget.value)}
          />

          <s-select
            label="Currency"
            value={currency}
            onChange={(event) => setCurrency(event.currentTarget.value)}
          >
            <s-option value="USD">USD - US Dollar</s-option>
            <s-option value="EUR">EUR - Euro</s-option>
            <s-option value="GBP">GBP - British Pound</s-option>
            <s-option value="CAD">CAD - Canadian Dollar</s-option>
            <s-option value="AUD">AUD - Australian Dollar</s-option>
          </s-select>

          <s-text-field
            label="Button Text"
            value={buttonText}
            placeholder="Pay with PayPal"
            onInput={(event) => setButtonText(event.currentTarget.value)}
          />

          <s-checkbox
            label="Enable PayPal Gateway"
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
          />

          <s-button
            variant="primary"
            loading={isSaving}
            onClick={saveSettings}
          >
            Save Settings
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Shopify PayPal Setup">
        <s-stack direction="block" gap="base">
          <s-text>
            Your PayPal email is saved in this app. To accept PayPal payments,
            activate PayPal in your Shopify payment settings.
          </s-text>

          <s-button
            href={"https://" + "admin.shopify.com/store/" + shop.replace(".myshopify.com", "") + "/settings/payments"}
            target="_blank"
          >
            Open Shopify Payments
          </s-button>
        </s-stack>
      </s-section>
     
 <s-section heading="Current Configuration">
        <s-stack direction="block" gap="base">
          <s-text>
            PayPal Email: {paypalEmail || "Not configured"}
          </s-text>

          <s-text>
            Currency: {currency}
          </s-text>

          <s-text>
            Status: {enabled ? "Enabled" : "Disabled"}
          </s-text>

          <s-text>
            Button: {buttonText || "Pay with PayPal"}
          </s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);

};
