package com.appTest.store.services;

import com.appTest.store.dto.saleDetail.MaterialMostSoldDTO;
import com.appTest.store.dto.saleDetail.SaleDetailDTO;
import com.appTest.store.models.SaleDetail;

import java.util.List;

public interface ISaleDetailService {

      public List<SaleDetail> getAllSaleDetail();

      public SaleDetail getSaleDetailById(Long idSaleDetail);

      public SaleDetailDTO convertSaleDetailToDto(SaleDetail saleDetail);

      public MaterialMostSoldDTO getMostSoldMaterial();

      public boolean deleteSaleDetailById(Long idSaleDetail);

      // agrega esta firma
      List<SaleDetailDTO> findBySaleId(Long saleId);


}
