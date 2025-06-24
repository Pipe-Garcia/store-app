package com.appTest.store.controllers;

import com.appTest.store.dto.productSale.ProductMostSoldDTO;
import com.appTest.store.dto.productSale.ProductSaleDTO;
import com.appTest.store.models.SaleDetail;
import com.appTest.store.services.IProductSaleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping ("/sale-details")
public class ProductSaleController {

    @Autowired
    private IProductSaleService servProdSale;

    @GetMapping
    public ResponseEntity<List<ProductSaleDTO>> getAllProductSale() {
        List<SaleDetail> saleDetailList = servProdSale.getAllProductSale();

        List<ProductSaleDTO> productSaleDTOList = saleDetailList.stream()
                .map(productSale -> servProdSale.convertProductSaleToDto(productSale))
                .collect(Collectors.toList());

        return ResponseEntity.ok(productSaleDTOList);
    }

    @GetMapping ("/{id}")
    public ResponseEntity<ProductSaleDTO> getProductSaleById(@PathVariable Long id) {
        SaleDetail saleDetail = servProdSale.getProductSaleById(id);
        if (saleDetail == null) {
            return ResponseEntity.notFound().build();
        }
        ProductSaleDTO productSaleDTO = servProdSale.convertProductSaleToDto(saleDetail);
        return ResponseEntity.ok(productSaleDTO);
    }

    @GetMapping ("/product-most-sold")
    public ResponseEntity<ProductMostSoldDTO> getProductMostSold() {
        ProductMostSoldDTO productMostSoldDTO = servProdSale.getMostSoldProduct();
        return ResponseEntity.ok(productMostSoldDTO);
    }

    @DeleteMapping ("/{id}")
    public ResponseEntity<String> deleteProductSaleById (@PathVariable Long id) {
        boolean deleted = servProdSale.deleteProductSaleById(id);
        if (deleted) {
            return ResponseEntity.ok("The sale detail has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }
}
