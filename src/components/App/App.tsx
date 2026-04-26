import React from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AuthProvider } from "../../auth/AuthContext";
import AdminLayout from "../../admin/AdminLayout";
import AdminLogin from "../../admin/AdminLogin";
import AdminProductForm from "../../admin/AdminProductForm";
import AdminProductList from "../../admin/AdminProductList";
import RequireAdmin from "../../admin/RequireAdmin";
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


/**
 * All app routes. Wrap with `BrowserRouter` / `MemoryRouter` at the app or test boundary.
 * Admin uses its own layout (no storefront chrome); see Epics E2-S6, UX-DR2.
 */
export function AppRoutes() {
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


  return (
        <div className="App">
          {/* <StripeProvider> */}
          <Routes>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="products" replace />} />
              <Route element={<RequireAdmin />}>
                <Route path="products" element={<AdminProductList />} />
                <Route path="products/new" element={<AdminProductForm />} />
                <Route path="products/:id" element={<AdminProductForm />} />
              </Route>
            </Route>
            <Route element={<Layout />}>

            {/* Home Page */}
            <Route
              path="/"
              element={
                <Navigate to="/products" />
              }
            />
            <Route path='/products' element={
              <>
                <ProductList />
              </>
            }
            />
            {/* Women Page */}
            <Route
              path="/women"
              element={
                <>
                  <Hero
                    image="/assets/img/women_placeholder.jpeg"
                    title="Empower Your Style"
                    description="Elegant, timeless, and coming soon."
                  />
                  <GridSection items={womenItems} />
                </>
              }
            />
            {/* Cart Page */}
            <Route path="/cart" element={
              <>
                <CartPage />
              </>
            }
            />
            {/* Men Page */}
            <Route
              path="/men"
              element={
                <>
                  <Hero
                    image="/assets/img/Lifestyle.jpeg"
                    title="For the Modern Man"
                    description="Comfort meets style."
                  />
                  <GridSection items={menItems} />
                </>
              }
            />

            {/* Kids Page */}
            <Route
              path="/kids"
              element={
                <>
                  <Hero
                    image="/assets/img/kids_placeholder.jpeg"
                    title="Fun & Functional"
                    description="Comfort for the little ones."
                  />
                  <GridSection items={kidsItems} />
                </>
              }
            />

            {/* Sale Page */}
            <Route
              path="/sale"
              element={
                <>
                  <DiscountMessage />
                  <Hero
                    image="/assets/img/sale_placeholder.jpeg"
                    title="Limited Time Offers"
                    description="Grab the deals before they're gone!"
                  />
                  <GridSection items={saleItems} />
                </>
              }
            />

            <Route path="/checkout" element={<CheckoutPage />} />

            <Route
              path="/order-confirmation"
              element={
                <>
                  <OrderConfirmation />
                </>
              } />

            {/* Product Detail */}
            <Route path="/product/:slug" element={<ProductDetail />} />
            </Route>

          </Routes>
          {/* </StripeProvider> */}
        </div>
  );
}

const App: React.FC = () => {
  return (
    <CartProvider>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </CartProvider>
  );
};

export default App;