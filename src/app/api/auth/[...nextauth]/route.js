import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import mongoDbService from "../../../../../services/mongoDbService";
// Adjust this import to match your MongoDB service file

export const authOptions = {
  providers: [
    Credentials.default({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          const { db } = await mongoDbService.connect();
          const user = await db
            .collection("users")
            .findOne({ username: credentials.username });

          if (!user) {
            return null;
          }

          const isPasswordValid = await compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
          };
        } catch (error) {
          console.error("Error in auth:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.username = token.username;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
console.log({ aa: process.env.NEXTAUTH_SECRET });
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
