package com.appTest.store.services;

import com.appTest.store.dto.productSale.ProductMostSoldDTO;
import com.appTest.store.dto.productSale.ProductSaleDTO;
import com.appTest.store.models.SaleDetail;

import java.util.List;

public interface IProductSaleService {

      public List<SaleDetail> getAllProductSale();

      public SaleDetail getProductSaleById(Long idProductSale);

      public ProductSaleDTO convertProductSaleToDto(SaleDetail saleDetail);

      public ProductMostSoldDTO getMostSoldProduct();

      public boolean deleteProductSaleById(Long idProductSale);
}
