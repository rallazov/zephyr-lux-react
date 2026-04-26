import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation } from 'react-router-dom'; // If you're passing data
const OrderConfirmation = () => {
    const location = useLocation(); // For accessing passed data (optional)
    const orderId = location.state?.orderId;
    const total = location.state?.total;
    const items = location.state?.items;
    return (_jsxs("div", { children: [_jsx("h1", { children: "Order Confirmed!" }), orderId && _jsxs("p", { children: ["Order ID: ", orderId] }), " ", total && _jsxs("p", { children: ["Total: $", total.toFixed(2)] }), items && (_jsxs("div", { children: [_jsx("h2", { children: "Items" }), _jsx("ul", { children: items.map((item) => (_jsxs("li", { children: [item.name, " x ", item.quantity, " - $", item.price.toFixed(2)] }, item.id))) })] }))] }));
};
export default OrderConfirmation;
