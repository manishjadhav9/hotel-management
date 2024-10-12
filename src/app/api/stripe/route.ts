import Stripe from "stripe";

import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/auth";
import { getRoom } from "@/libs/apis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-09-30.acacia',
});

type RequestData = {
  checkinDate: string;
  checkoutDate: string;
  adults: number;
  children: number;
  numberOfDays: number;
  hotelRoomSlug: string;
};

export async function POST(req: Request) {
  const {
    checkinDate,
    adults,
    checkoutDate,
    children,
    hotelRoomSlug,
    numberOfDays,
  }: RequestData = await req.json();

  if (
    !checkinDate ||
    !checkoutDate ||
    !adults ||
    !hotelRoomSlug ||
    !numberOfDays
  ) {
    return new NextResponse('Please all fields are required', { status: 400 });
  }

  const origin = req.headers.get('origin');

  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse('Authentication required', { status: 400 });
  }

  const userId = session.user.id;
  const formattedCheckoutDate = checkoutDate.split('T')[0];
  const formattedCheckinDate = checkinDate.split('T')[0];

  try {
    const room = await getRoom(hotelRoomSlug);
    const discountPrice = room.price - (room.price / 100) * room.discount;
    const totalPrice = discountPrice * numberOfDays;

    //Create a Stripe Payment
    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: {
              name: room.name,
              images: room.images.map(image => image.url),
            },
            unit_amount: parseInt((totalPrice * 100).toString()),
          },
        },
      ],
      payment_method_types: ['card'],
      success_url: `${origin}/users/${userId}`,
      metadata: {
        adults,
        checkinDate: formattedCheckinDate,
        checkoutDate: formattedCheckoutDate,
        children,
        hotelRoom: room._id,
        numberOfDays,
        user: userId,
        discountPrice: room.discount,
        totalPrice
      }
    });

    return NextResponse.json(stripeSession, {
      status: 200,
      statusText: 'Payment session created',
    });

  } catch (error: unknown) {
    if (error instanceof Error) {
        console.log('Payment failed', error.message);
        return new NextResponse(error.message, { status: 500 });
    }
    console.log('Payment failed', error);
    return new NextResponse('An unknown error occurred', { status: 500 });
}

}