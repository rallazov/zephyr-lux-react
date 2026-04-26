import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { CartProvider } from "../../context/CartContext";
import CartPage from '../Cart/CartPage';
import CheckoutPage from "../Cart/CheckoutPage";
// import StripeProvider from '../Cart/StripeProvider';
import DiscountMessage from '../DiscountMessages/DiscountMessage';
import GridSection from '../GridSection/GridSection';
import Hero from '../Hero/Hero';
import OrderConfirmation from '../OrderConfirmation/OrderConfirmation';
import ProductDetail from '../ProductDetail/ProductDetail';
import ProductList from '../ProductList/ProductList';
import './App.css';
import Layout from './Layout';
const App = () => {
    // ... (your existing code)
    const womenItems = [
        { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Women Product 1" },
        { imgSrc: "assets/img/Lifestyle.jpeg", description: "Women Product 2" },
        { saleText: "New Arrivals!", isSale: true },
        { imgSrc: "assets/img/Lifestyle.jpeg", description: "Women Product 3" },
    ];
    const menItems = [
        { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Men Product 1" },
        { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Men Product 2" },
        { saleText: "Exclusive Offer!", isSale: true },
        { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Men Product 3" },
    ];
    const kidsItems = [
        { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Kids Product 1" },
        { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Kids Product 2" },
        { saleText: "Limited Edition!", isSale: true },
        { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Kids Product 3" },
    ];
    const saleItems = [
        { imgSrc: "/assets/img/Infographic.jpeg", description: "Sale Product 1" },
        { imgSrc: "/assets/img/Infographic.jpeg", description: "Sale Product 2" },
        { saleText: "Best Deals!", isSale: true },
        { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Sale Product 3" },
    ];
    return (_jsx(CartProvider, { children: _jsx(Router, { children: _jsx("div", { className: "App", children: _jsx(Routes, { children: _jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/products" }) }), _jsx(Route, { path: '/products', element: _jsx(_Fragment, { children: _jsx(ProductList, {}) }) }), _jsx(Route, { path: "/women", element: _jsxs(_Fragment, { children: [_jsx(Hero, { image: "/assets/img/women_placeholder.jpeg", title: "Empower Your Style", description: "Elegant, timeless, and coming soon." }), _jsx(GridSection, { items: womenItems })] }) }), _jsx(Route, { path: "/cart", element: _jsx(_Fragment, { children: _jsx(CartPage, {}) }) }), _jsx(Route, { path: "/men", element: _jsxs(_Fragment, { children: [_jsx(Hero, { image: "/assets/img/Lifestyle.jpeg", title: "For the Modern Man", description: "Comfort meets style." }), _jsx(GridSection, { items: menItems })] }) }), _jsx(Route, { path: "/kids", element: _jsxs(_Fragment, { children: [_jsx(Hero, { image: "/assets/img/kids_placeholder.jpeg", title: "Fun & Functional", description: "Comfort for the little ones." }), _jsx(GridSection, { items: kidsItems })] }) }), _jsx(Route, { path: "/sale", element: _jsxs(_Fragment, { children: [_jsx(DiscountMessage, {}), _jsx(Hero, { image: "/assets/img/sale_placeholder.jpeg", title: "Limited Time Offers", description: "Grab the deals before they're gone!" }), _jsx(GridSection, { items: saleItems })] }) }), _jsx(Route, { path: "/checkout", element: _jsx(CheckoutPage, {}) }), _jsx(Route, { path: "/order-confirmation", element: _jsx(_Fragment, { children: _jsx(OrderConfirmation, {}) }) }), _jsx(Route, { path: "/product/:slug", element: _jsx(ProductDetail, {}) })] }) }) }) }) }));
};
export default App;
