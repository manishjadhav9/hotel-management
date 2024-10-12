import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createBooking, updateHotelRoom } from "@/libs/apis";

const checkout_session_completed = "checkout.session.completed";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-09-30.acacia",
});

export async function POST(req: Request) {
  const reqBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) return;
    event = stripe.webhooks.constructEvent(reqBody, sig, webhookSecret);
  } catch (error: unknown) {
    if (error instanceof Error) {
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 500 });
    } else {
        return new NextResponse('Unknown Webhook Error', { status: 500 });
    }
}

  // load our event
  switch (event.type) {
    case checkout_session_completed:
      const session = event.data.object;

      const {
        metadata: {
          adults,
          checkinDate,
          checkoutDate,
          children,
          hotelRoom,
          numberOfDays,
          user,
          discountPrice,
          totalPrice,
        },
      } = session;

      await createBooking({
        adults: Number(adults),
        checkinDate,
        checkoutDate,
        children: Number(children),
        hotelRoom,
        numberOfDays: Number(numberOfDays),
        discount: Number(discountPrice),
        totalPrice: Number(totalPrice),
        user,
      });

      //update hotel room
      await updateHotelRoom(hotelRoom);
      
      return NextResponse.json("Booking successful", {
        status: 200,
        statusText: "Booking Successful",
      });

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json("Event Received", {
    status: 200,
    statusText: "Event Received",
  });
}
