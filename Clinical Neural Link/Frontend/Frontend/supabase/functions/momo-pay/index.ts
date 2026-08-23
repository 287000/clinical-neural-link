import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { studentNumber, phoneNumber, amount } = await req.json();

    const MOMO_PRIMARY_KEY = Deno.env.get("MOMO_PRIMARY_KEY") || "";
    const MOMO_API_USER = Deno.env.get("MOMO_API_USER") || "";
    const MOMO_API_KEY = Deno.env.get("MOMO_API_KEY") || "";
    const ENVIRONMENT = Deno.env.get("MOMO_ENV") || "sandbox";

    const BASE_URL = ENVIRONMENT === "sandbox"
      ? "https://sandbox.momodeveloper.mtn.com"
      : "https://proxy.momoapi.mtn.com";

    const referenceId = crypto.randomUUID();

    let formattedPhone = phoneNumber.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "260" + formattedPhone.slice(1);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Record transaction in payments_ledger
    const { error: dbError } = await supabase.from("payments_ledger").insert({
      student_number: studentNumber,
      phone_number: formattedPhone,
      amount: parseFloat(amount),
      reference_id: referenceId,
      provider: "MTN_MOMO",
      status: "PENDING"
    });

    if (dbError) throw new Error(`Database error: ${dbError.message}`);

    // Fetch OAuth Token from MTN
    const authHeader = "Basic " + btoa(`${MOMO_API_USER}:${MOMO_API_KEY}`);
    const tokenRes = await fetch(`${BASE_URL}/collection/token/`, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Ocp-Apim-Subscription-Key": MOMO_PRIMARY_KEY,
      },
    });

    if (!tokenRes.ok) {
      throw new Error(`MTN Token Request Failed: ${await tokenRes.text()}`);
    }

    const { access_token } = await tokenRes.json();

    // Trigger RequestToPay USSD Push
    const payRes = await fetch(`${BASE_URL}/collection/v1_0/requesttopay`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "X-Reference-Id": referenceId,
        "X-Target-Environment": ENVIRONMENT,
        "Ocp-Apim-Subscription-Key": MOMO_PRIMARY_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: "ZMW",
        externalId: referenceId.slice(0, 8),
        payer: { partyIdType: "MSISDN", partyId: formattedPhone },
        payerMessage: "Clinical Neural Link Access Fee",
        payeeNote: "Student Access",
      }),
    });

    if (payRes.status === 202 || payRes.ok) {
      return new Response(
        JSON.stringify({ success: true, referenceId, message: "USSD prompt sent." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: await payRes.text() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});