import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // Sadece belirlediğin mailler giriş yapabilsin (whitelist)
    async signIn({ user }) {
      const allowed = [
        "ahmet@albamedia.nl",
        "119007948+hemree@users.noreply.github.com",
        "test@albamedia.nl",
        // Diğer yetkili email'ler buraya eklenebilir
      ];
      
      console.log(`Login attempt: ${user?.email}`);
      
      if (!user?.email) {
        console.log("No email provided");
        return false;
      }
      
      const isAllowed = allowed.includes(user.email);
      console.log(`Email ${user.email} is ${isAllowed ? 'allowed' : 'not allowed'}`);
      
      return isAllowed;
    },
    
    async session({ session, token }) {
      // Session'a ek bilgiler ekleyebiliriz
      return session;
    },
    
    async jwt({ token, user }) {
      // JWT token'a ek bilgiler ekleyebiliriz
      return token;
    }
  },
  
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  
  session: {
    strategy: 'jwt',
  },
});
