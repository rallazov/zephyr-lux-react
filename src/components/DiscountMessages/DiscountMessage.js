import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import './DiscountMessage.css';
const DiscountMessage = () => {
    return (_jsxs("div", { className: "discount-message", children: [_jsx("h2", { children: "LONG WEEKEND SALE" }), _jsxs("div", { className: "discount-container", children: [_jsxs("div", { className: "discount-item", children: [_jsx("span", { className: "discount-amount", children: "60% OFF" }), _jsx("span", { className: "discount-text", children: "SITEWIDE" })] }), _jsx("div", { className: "vertical-line" }), _jsxs("div", { className: "discount-item", children: [_jsx("span", { className: "discount-amount", children: "20% OFF" }), _jsx("span", { className: "discount-text", children: "YOUR ORDER" })] })] }), _jsxs("div", { className: "cta-buttons", children: [_jsx(Link, { to: "/women", className: "btn", children: "Shop Women" }), _jsx(Link, { to: "/men", className: "btn", children: "Shop Men" })] })] }));
};
export default DiscountMessage;
