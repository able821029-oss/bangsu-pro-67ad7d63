import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()

    const KAKAO_ADMIN_KEY = Deno.env.get('KAKAO_ADMIN_KEY') || ''
    const KAKAO_CID = Deno.env.get('KAKAO_CID') || 'TCSUBSCRIP'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Test mode: if no admin key, simulate responses
    const isTestMode = !KAKAO_ADMIN_KEY || KAKAO_ADMIN_KEY === ''

    if (action === 'ready') {
      const { userId, planName, amount, approvalUrl, cancelUrl, failUrl } = params
      const partnerOrderId = `order_${userId}_${Date.now()}`

      if (isTestMode) {
        return new Response(JSON.stringify({
          test_mode: true,
          tid: `T_TEST_${Date.now()}`,
          next_redirect_mobile_url: `${approvalUrl}?pg_token=test_token_${Date.now()}`,
          next_redirect_pc_url: `${approvalUrl}?pg_token=test_token_${Date.now()}`,
          partner_order_id: partnerOrderId,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const res = await fetch('https://kapi.kakao.com/v1/payment/ready', {
        method: 'POST',
        headers: {
          'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          cid: KAKAO_CID,
          partner_order_id: partnerOrderId,
          partner_user_id: userId,
          item_name: `SMS ${planName} 구독`,
          quantity: '1',
          total_amount: String(amount),
          tax_free_amount: '0',
          approval_url: approvalUrl,
          cancel_url: cancelUrl,
          fail_url: failUrl,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ ...data, partner_order_id: partnerOrderId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'approve') {
      const { tid, pgToken, userId, partnerOrderId } = params

      if (isTestMode) {
        const testSid = `S_TEST_${Date.now()}`
        // Save test subscription
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          plan: params.planName || '베이직',
          payment_method: 'kakao',
          kakao_sid: testSid,
          partner_order_id: partnerOrderId,
          amount: params.amount || 9900,
          status: 'active',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'user_id' })

        return new Response(JSON.stringify({
          test_mode: true,
          sid: testSid,
          approved_at: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const res = await fetch('https://kapi.kakao.com/v1/payment/approve', {
        method: 'POST',
        headers: {
          'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          cid: KAKAO_CID,
          tid,
          partner_order_id: partnerOrderId,
          partner_user_id: userId,
          pg_token: pgToken,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Save subscription with SID
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        plan: params.planName || '베이직',
        payment_method: 'kakao',
        kakao_sid: data.sid,
        partner_order_id: partnerOrderId,
        amount: data.amount?.total || 0,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'user_id' })

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'subscription') {
      const { sid, userId, amount } = params

      if (isTestMode) {
        return new Response(JSON.stringify({
          test_mode: true,
          status: 'SUCCESS',
          approved_at: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const partnerOrderId = `order_${userId}_${Date.now()}`
      const res = await fetch('https://kapi.kakao.com/v1/payment/subscription', {
        method: 'POST',
        headers: {
          'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          cid: KAKAO_CID,
          sid,
          partner_order_id: partnerOrderId,
          partner_user_id: userId,
          quantity: '1',
          total_amount: String(amount),
          tax_free_amount: '0',
        }),
      })

      const data = await res.json()
      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
