package com.appTest.store.services;

import com.appTest.store.dto.product.*;
import com.appTest.store.models.Product;

import java.util.List;

public interface IProductService {

      public List<Product> getAllProducts();

      public ProductDTO convertProductToDto(Product product);

      public Product getProductById(Long idProduct);

      public List<ProductStockAlertDTO> getProductsWithLowStock();

      public ProductMostExpensiveDTO getProductByHighestPrice();

      public void createProduct(ProductCreateDTO dto);

      public void updateProduct(ProductUpdateDTO dto);

      public boolean deleteProductById(Long idProduct);
}
