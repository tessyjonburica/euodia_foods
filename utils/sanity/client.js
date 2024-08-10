import { createClient } from '@sanity/client';
import { ensureUserExists } from '../lib/checkUser';

export const client = createClient({
  projectId: '8bms2xqg',
  dataset: 'production',
  apiVersion: '2024-03-11',
  useCdn: true,
  token: process.env.NEXT_PUBLIC_SANITY_TOKEN
});

export const getUserByEmail = async (email) => {
  const query = '*[_type == "customer" && email == $email][0]';
  const params = { email };
console.log(email)
  try {
    const user = await client.fetch(query, params);
    return user;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return null;
  }
};
export const getAdminByEmail = async (email) => {
  const query = '*[_type == "admin" && email == $email][0]';
  const params = { email };
console.log(email)
  try {
    const user = await client.fetch(query, params);
    return user;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return null;
  }
};


export const createUser = async (user) => {
  try {
    const sanityResponse = await client.create({ _type: 'customer', ...user });
    return sanityResponse;
  } catch (sanityError) {
    return { error: 'Internal Server Error', message: sanityError.message };
  }
};
export const createAdmin = async (user) => {
  try {
    const sanityResponse = await client.create({ _type: 'admin', ...user });
    console.log('User saved to Sanity:', sanityResponse);
    return sanityResponse;
  } catch (sanityError) {
    console.error('Error saving user to Sanity:', sanityError);
    return { error: 'Internal Server Error', message: sanityError.message };
  }
};


export const createOrder = async ({
  cartItems,
  amount,
  email,
  name,
  streetAddress,
  apartment,
  townCity,
  phone,
  deliveryAddress,
  transactionRef,
  note,
  user // User object is passed here
}
) => {
  const cartItemsWithKeys = cartItems.map((item, index) => ({
    ...item,
    _key: `orderedItem_${index}`,
  }));

  // Extract userId from the user object
  const userId = user?._ref;

  try {
    // Ensure the user exists or create a new one if necessary
    const ensuredUser = await ensureUserExists(userId);

    // Create the order document in Sanity
    const order = await client.create({
      _type: 'order',
      cartItems: cartItemsWithKeys,
      amount,
      transactionDate: new Date(), // Use current date for transactionDate
      email,
      name,
      streetAddress,
      apartment,
      townCity,
      phone,
      deliveryAddress,
      transactionRef,
      note,
      user: { _type: 'reference', _ref: ensuredUser._id }, // Use the ensured user ID
    });

    await client.patch(order._id).set({ orderId: order._id }).commit();

    console.log('Order saved to Sanity:', order);
    return order;
  } catch (sanityError) {
    console.error('Error saving order to Sanity:', sanityError);
    return { error: 'Internal Server Error', message: sanityError.message };
  }
};

export const createTransaction = async (
  order,
  amount,
  email,
  deliveryAddress,
  transactionRef,
  id,
  status = 'pending', // Default value is 'pending'
) => {
  
  try {
    // Your logic to create a transaction document in Sanity
    const transaction = await client.create({
      _type: 'transaction',
      order: {
        _type: 'reference',
        _ref: order._id, // Assuming order._id is the Sanity document ID of the order
      },
      amount,
      email,
      deliveryAddress,
      transactionRef,
      id,
      transactionDate: new Date(), // Use current date for transactionDate
      status,
    });

    console.log('Transaction saved to Sanity:', transaction);

    
    return transaction;
  } catch (sanityError) {
    console.error('Error saving transaction to Sanity:', sanityError);
    return { error: 'Internal Server Error', message: sanityError.message };
  }
};

export const getTransactionRefs = async () => {
  try {
    // Query Sanity to fetch all transactions and select the transactionRef field
    const transactions = await client.fetch(`*[_type == 'transaction']{transactionRef}`);

    // Extract and return an array of transactionRef values
    const transactionRefs = transactions.map(transaction => transaction.transactionRef);
    
    return transactionRefs;
  } catch (error) {
    console.error('Error fetching transaction references:', error);
    throw error;
  }
};


export const updateTransactionStatus = async (transactionRef, newStatus) => {
  try {
    // Query Sanity to fetch the transaction with the given transactionRef
    const transaction = await client.fetch(`*[_type == 'transaction' && transactionRef == $transactionRef][0]`, { transactionRef });

    // Check if transaction exists
    if (!transaction) {
      throw new Error(`Transaction with transactionRef ${transactionRef} not found`);
    }

    // Update the status field with the new status value
    const updatedTransaction = await client
      .patch(transaction._id) // Use the _id of the fetched transaction
      .set({ status: newStatus })
      .commit();

    return updatedTransaction;
  } catch (error) {
    console.error('Error updating transaction status:', error);
    throw error;
  }
};