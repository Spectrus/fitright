// Comprehensive fix for basket minus buttons
// This script ensures basket minus buttons work properly across all pages

function fixBasketButtons() {
  console.log('Fixing basket buttons...');
  
  // Function to add event listeners to basket minus buttons
  function addBasketButtonListeners(container) {
    if (!container) return;
    
    // Remove any existing listeners first
    container.querySelectorAll('.basket-minus-btn').forEach(btn => {
      btn.removeEventListener('click', basketButtonHandler);
    });
    
    // Add new listeners
    container.querySelectorAll('.basket-minus-btn').forEach(btn => {
      btn.addEventListener('click', basketButtonHandler);
      console.log('Added event listener to basket button:', btn);
    });
  }
  
  // Unified event handler for basket minus buttons
  async function basketButtonHandler(e) {
    e.stopPropagation();
    e.preventDefault();
    
    const itemId = this.getAttribute('data-id');
    const currentQty = parseInt(this.parentElement.querySelector('.basket-qty').textContent);
    
    console.log('Basket minus button clicked for item:', itemId, 'current qty:', currentQty);
    
    if (window.FitRightFirebase) {
      try {
        if (currentQty > 1) {
          await window.FitRightFirebase.updateQuantity(itemId, currentQty - 1);
          console.log('Quantity updated for item:', itemId);
        } else {
          await window.FitRightFirebase.removeFromCart(itemId);
          console.log('Item removed from cart:', itemId);
        }
      } catch (error) {
        console.error('Error updating cart:', error);
        if (typeof showToast === 'function') {
          showToast("Error updating basket: " + error.message);
        }
      }
    } else {
      // Fallback to localStorage
      let basket = JSON.parse(localStorage.getItem("basket")) || [];
      const index = parseInt(this.getAttribute('data-index'));
      if (currentQty > 1) {
        basket[index].quantity = currentQty - 1;
      } else {
        basket.splice(index, 1);
      }
      localStorage.setItem("basket", JSON.stringify(basket));
      
      // Trigger update if updateBasketDropdown function exists
      if (typeof updateBasketDropdown === 'function') {
        updateBasketDropdown();
      }
      if (typeof updateBasketCounter === 'function') {
        updateBasketCounter();
      }
    }
  }
  
  // Apply to both desktop and mobile dropdowns
  const basketDropdownContent = document.getElementById('basketDropdownContent');
  const basketDropdownContentMobile = document.getElementById('basketDropdownContentMobile');
  
  addBasketButtonListeners(basketDropdownContent);
  addBasketButtonListeners(basketDropdownContentMobile);
  
  console.log('Basket buttons fixed!');
}

// Run the fix when the page loads
document.addEventListener('DOMContentLoaded', fixBasketButtons);

// Also run when cart is updated
window.addEventListener('cartUpdated', () => {
  setTimeout(fixBasketButtons, 100); // Small delay to ensure DOM is updated
});

// Export for use in other scripts
window.fixBasketButtons = fixBasketButtons; 