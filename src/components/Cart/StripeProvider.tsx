import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

interface StripeProviderProps {
    children: React.ReactNode;
}

const stripePromise = loadStripe("pk_test_xxxxxxxxxxxxxxxxxxxxxxxx");

const StripeProvider: React.FC<StripeProviderProps> = ({ children }) => {
    return (
        <Elements stripe={stripePromise}>
            {children}
        </Elements>
    )
}

export default StripeProvider;

