import React from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AuthProvider } from "../../auth/AuthContext";
import AdminLayout from "../../admin/AdminLayout";
import AdminLogin from "../../admin/AdminLogin";
import AdminOrderDetail from "../../admin/AdminOrderDetail";
import AdminOrderList from "../../admin/AdminOrderList";
import AdminProductForm from "../../admin/AdminProductForm";
import AdminProductList from "../../admin/AdminProductList";
import RequireAdmin from "../../admin/RequireAdmin";
import { COLLECTION_ROUTES } from "../../catalog/collections";
import { CartProvider } from "../../context/CartContext";
import CartPage from '../Cart/CartPage';
import CheckoutPage from "../Cart/CheckoutPage";
import CollectionPage from "../Collection/CollectionPage";
// import StripeProvider from '../Cart/StripeProvider';
import HomePage from "../Home/HomePage";
import AccountPage from "../../account/AccountPage";
import AccountOrderDetailPage from "../../account/AccountOrderDetailPage";
import OrderConfirmation from '../OrderConfirmation/OrderConfirmation';
import CustomerOrderStatusPage from "../../order-status/CustomerOrderStatusPage";
import OrderStatusLookup from "../../order-status/OrderStatusLookup";
import ProductDetail from '../ProductDetail/ProductDetail';
import ProductList from '../ProductList/ProductList';
import './App.css';
import ContactPage from "../Contact/ContactPage";
import PoliciesIndex from "../Policies/PoliciesIndex";
import PolicyPrivacyPage from "../Policies/PolicyPrivacyPage";
import PolicyReturnsPage from "../Policies/PolicyReturnsPage";
import PolicyShippingPage from "../Policies/PolicyShippingPage";
import PolicyTermsPage from "../Policies/PolicyTermsPage";
import SubscriptionsPage from "../../pages/SubscriptionsPage";
import SubscriptionCheckoutCanceledPage from "../../pages/SubscriptionCheckoutCanceledPage";
import SubscriptionCheckoutSuccessPage from "../../pages/SubscriptionCheckoutSuccessPage";
import Layout from './Layout';
import SearchPage from '../Search/SearchPage';


/**
 * All app routes. Wrap with `BrowserRouter` / `MemoryRouter` at the app or test boundary.
 * Admin uses its own layout (no storefront chrome); see Epics E2-S6, UX-DR2.
 */
export function AppRoutes() {
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
                <Route path="orders" element={<AdminOrderList />} />
                <Route path="orders/:id" element={<AdminOrderDetail />} />
              </Route>
            </Route>
            <Route element={<Layout />}>

            {/* Home Page */}
            <Route path="/" element={<HomePage />} />
            <Route path='/products' element={
              <>
                <ProductList />
              </>
            }
            />
            <Route path="/search" element={<SearchPage />} />
            {COLLECTION_ROUTES.map((c) => (
              <Route
                key={c.path}
                path={c.path}
                element={<CollectionPage collection={c} />}
              />
            ))}
            {/* Cart Page */}
            <Route path="/cart" element={
              <>
                <CartPage />
              </>
            }
            />

            <Route path="/checkout" element={<CheckoutPage />} />

            <Route path="/account" element={<AccountPage />} />
            <Route path="/account/orders/:orderId" element={<AccountOrderDetailPage />} />

            <Route
              path="/order-confirmation"
              element={
                <>
                  <OrderConfirmation />
                </>
              } />
            <Route path="/order-status/:token" element={<CustomerOrderStatusPage />} />
            <Route path="/order-status" element={<OrderStatusLookup />} />

            <Route path="/product/:slug" element={<ProductDetail />} />

            <Route path="/policies" element={<PoliciesIndex />} />
            <Route path="/policies/shipping" element={<PolicyShippingPage />} />
            <Route path="/policies/returns" element={<PolicyReturnsPage />} />
            <Route path="/policies/privacy" element={<PolicyPrivacyPage />} />
            <Route path="/policies/terms" element={<PolicyTermsPage />} />
            <Route path="/policies/*" element={<Navigate to="/policies" replace />} />

            <Route path="/contact" element={<ContactPage />} />

            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route
              path="/subscription/checkout/success"
              element={<SubscriptionCheckoutSuccessPage />}
            />
            <Route
              path="/subscription/checkout/canceled"
              element={<SubscriptionCheckoutCanceledPage />}
            />
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
