import { isAdmin } from "@/utils/lib/auth";
import { client } from "@/utils/sanity/client";
import { NextResponse } from "next/server";
import { parseNairaPrice } from "@/utils/money";

// export async function PATCH(req, { params }) {
//   if (!isAdmin(req.headers)) {
//     return new Response(JSON.stringify({ error: "Forbidden" }), {
//       status: 403,
//       headers: { "Content-Type": "application/json" },
//     });
//   }
//   const { id } = params;

//   try {
//     const { locationName, fee } = await req.json();

//     // Update the service fee
//     const updatedServiceFee = await client
//       .patch(id)
//       .set({ locationName, fee })
//       .commit();

//     // Update the location schema
//     const locationQuery = `*[_type == "location" && references("${id}")][0]`;
//     const locationData = await client.fetch(locationQuery);

//     if (locationData) {
//       await client
//         .patch(locationData._id)
//         .set({
//           locationName: updatedServiceFee.locationName,
//           fee: updatedServiceFee.fee,
//         })
//         .commit();
//     }

//     return NextResponse.json(updatedServiceFee);
//   } catch (error) {
//     return NextResponse.json(
//       { message: "Failed to update service fee and location" },
//       { status: 500 }
//     );
//   }
// }

export async function PATCH(req, { params }) {
  if (!isAdmin(req.headers)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = params;

  try {
    const { location, fee } = await req.json();
    const numericFee = parseNairaPrice(fee);
    if (numericFee === null) {
      return NextResponse.json({ message: "Enter a valid delivery fee of zero or more." }, { status: 400 });
    }

    // Update the service fee
    const updatedServiceFee = await client
      .patch(id)
      .set({ location, fee: numericFee })
      .commit();

    // Update the related location schema
    // const locationQuery = `*[_type == "location" && references("${id}")][0]`;
    // const locationData = await client.fetch(locationQuery);

    // if (locationData) {
    //   await client
    //     .patch(locationData._id)
    //     .set({
    //       name: updatedServiceFee.location,
    //       fee: updatedServiceFee.fee,
    //     })
    //     .commit();
    // }

    return NextResponse.json(updatedServiceFee);
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to update service fee and location" },
      { status: 500 }
    );
  }
}

export async function DELETE(req,{ params }) {
  if (!isAdmin(req.headers)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
    const { id } = params;
  
    try {
      // Fetch the service fee
      const serviceFeeQuery = `*[_type == "serviceFee" && _id == "${id}"][0]`;
      const serviceFeeData = await client.fetch(serviceFeeQuery);
  
      if (!serviceFeeData) {
        return NextResponse.json(
          { message: "Service fee not found" },
          { status: 404 }
        );
      }
  
      // Delete the service fee
      await client.delete(id);
  
      // Update the location schema
      const locationQuery = `*[_type == "location" && references("${id}")][0]`;
      const locationData = await client.fetch(locationQuery);
  
      if (locationData) {
        await client
          .patch(locationData._id)
          .unset(["locationName", "fee"])
          .commit();
      }
  
      return NextResponse.json({ message: "Service fee deleted successfully" });
    } catch (error) {
      return NextResponse.json(
        { message: "Failed to delete service fee and update location" },
        { status: 500 }
      );
    }
  }
