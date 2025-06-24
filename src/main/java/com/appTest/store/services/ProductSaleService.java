package com.appTest.store.services;

import com.appTest.store.dto.productSale.ProductMostSoldDTO;
import com.appTest.store.dto.productSale.ProductSaleDTO;
import com.appTest.store.models.SaleDetail;
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
    public List<SaleDetail> getAllProductSale() {
        return repoProdSale.findAll();
    }

    @Override
    public SaleDetail getProductSaleById(Long idProductSale) {
        return repoProdSale.findById(idProductSale).orElse(null);
    }

    @Override
    public ProductSaleDTO convertProductSaleToDto(SaleDetail saleDetail) {

        Double quantityProd = saleDetail.getQuantity();
        Double priceProd = saleDetail.getPriceUni();
        String nameProd = saleDetail.getMaterial().getName();

        LocalDate dateSale = saleDetail.getSale().getDateSale();

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
        SaleDetail saleDetail = repoProdSale.findById(idProductSale).orElse(null);
        if (saleDetail != null) {
            repoProdSale.deleteById(idProductSale);
            return true;
        }
        return false;
    }
}
