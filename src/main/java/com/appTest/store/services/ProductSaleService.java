package com.appTest.store.services;

import com.appTest.store.dto.productSale.ProductMostSoldDTO;
import com.appTest.store.dto.productSale.ProductSaleDTO;
import com.appTest.store.models.ProductSale;
import com.appTest.store.repositories.IProductSaleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class ProductSaleService implements IProductSaleService{

    @Autowired
    private IProductSaleRepository repoProdSale;

    @Override
    public List<ProductSale> getAllProductSale() {
        return repoProdSale.findAll();
    }

    @Override
    public ProductSale getProductSaleById(Long idProductSale) {
        return repoProdSale.findById(idProductSale).orElse(null);
    }

    @Override
    public ProductSaleDTO convertProductSaleToDto(ProductSale productSale) {

        Double quantityProd = productSale.getQuantity();
        Double priceProd = productSale.getPriceUni();
        String nameProd = productSale.getProduct().getName();

        LocalDate dateSale = productSale.getSale().getDateSale();

        return new ProductSaleDTO(
                dateSale,
                priceProd,
                nameProd,
                quantityProd
        );
    }

    @Override
    public ProductMostSoldDTO getMostSoldProduct() {
        List<ProductMostSoldDTO> result = repoProdSale.getMostSoldProduct(PageRequest.of(0, 1));
        return result.isEmpty() ? null : result.get(0);
    }


    @Override
    public boolean deleteProductSaleById(Long idProductSale) {
        ProductSale productSale = repoProdSale.findById(idProductSale).orElse(null);
        if (productSale != null) {
            repoProdSale.deleteById(idProductSale);
            return true;
        }
        return false;
    }
}
