import React from 'react';
import { useLocation } from 'react-router-dom'; // If you're passing data

const OrderConfirmation: React.FC = () => {
    const location = useLocation(); // For accessing passed data (optional)
    const orderId = location.state?.orderId;
    const total = location.state?.total;
    const items = location.state?.items;

    return (
        <div>
            <h1>Order Confirmed!</h1>
            {orderId && <p>Order ID: {orderId}</p>} {/* Conditionally render */}
            {total && <p>Total: ${total.toFixed(2)}</p>}
            {items && (
                <div>
                    <h2>Items</h2>
                    <ul>
                        {items.map((item: { id: React.Key | null | undefined; name: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; quantity: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; price: number; }) => (
                            <li key={item.id}>
                                {item.name} x {item.quantity} - ${item.price.toFixed(2)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {/* ... other confirmation details */}
        </div>
    );
};

export default OrderConfirmation;