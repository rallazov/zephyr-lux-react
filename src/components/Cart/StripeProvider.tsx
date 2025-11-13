// import { Elements } from "@stripe/react-stripe-js";
// import { loadStripe } from "@stripe/stripe-js";
// import React, { useEffect, useState } from "react";

// interface StripeProviderProps {
//     children: React.ReactNode;
// }

// const stripePromise = loadStripe("pk_test_xxxxxxxxxxxxxxxxxxxxxxxx");

// const StripeProvider: React.FC<StripeProviderProps> = ({ children }) => {
//     const [clientSecret, setClientSecret] = useState<string | null>(null);

//     useEffect(() => {
//         // Mock client secret for testing purposes
//         setClientSecret("mock_client_secret_12345");
//     }, []);

//     if (!clientSecret) {
//         return <p>Loading Payment...</p>; // Prevent rendering until secret is set
//     }

//     return (
//         <Elements stripe={stripePromise} options={{ clientSecret }}>
//             {children}
//         </Elements>
//     );
// };

// export default StripeProvider;
