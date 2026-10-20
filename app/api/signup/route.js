// pages/api/signup.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// import crypto from 'crypto';
import { createUser, getUserByEmail } from '@/utils/sanity/client';

// Function to generate a random secret key
// const generateRandomSecret = () => {
//   return crypto.randomBytes(32).toString('hex');
// };

export  async function POST(req) {
 
  try{

      const res = await req.json()
      const { name, email, password } = res;
      if (typeof name !== 'string' || !name.trim() ||
          typeof email !== 'string' || !email.trim() ||
          typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
        return Response.json({ message: 'Name, email, and a password of at least 8 characters are required.' }, { status: 400 });
      }
      if (!process.env.NEXT_PRIVATE_JWT_SECRET_KEY) {
        console.error('Signup configuration error: JWT secret is missing');
        return Response.json({ message: 'Account registration is not configured. Please contact support.' }, { status: 503 });
      }
      const formattedEmail = email.trim().toLowerCase();
      const existingUser = await getUserByEmail(formattedEmail);
    
      if (existingUser) {
        if (!existingUser.password) {
          return Response.json({
            code: 'GUEST_ACCOUNT',
            message: 'You previously checked out as a guest. Use Set or reset password to verify your email and activate your account.',
          }, { status: 409 });
        }
        return new Response(JSON.stringify({ message: 'User with this email already exists' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
      }
    
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: uuidv4(),
        email: formattedEmail,
        name,
        password: hashedPassword,
        isAnonymous: false,
      };
      const newUser = await createUser(user);
      if (!newUser?._id || newUser.error) {
        throw new Error('Customer was not saved');
      }
    
      // const secretKey = generateRandomSecret();
      const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
    
      // Generate JWT token
      const token = jwt.sign({ userId: newUser._id  }, process.env.NEXT_PRIVATE_JWT_SECRET_KEY, { expiresIn: expiresIn });
    return new Response(JSON.stringify({ message: 'User signed up successfully!', user: { _id: newUser._id, name: newUser.name, email: newUser.email }, token }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    //   res.status(201).json({ user: newUser, token });
  }
  catch(err){
    console.error('Account registration failed:', err.message);
    return new Response(JSON.stringify({ message: 'Unable to save your account. Please try again or contact support.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
  }

}
